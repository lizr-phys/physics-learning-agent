"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Send } from "lucide-react";

import { parseExerciseRequest } from "@/agent/exercise-parser";
import { classifyAgentIntent } from "@/agent/intent-classifier";
import {
  createLearningMemory,
  updateLearningMemory,
  updateLearningProfile,
} from "@/agent/memory-manager";
import { CourseSelector } from "@/components/CourseSelector";
import { ErrorMessage } from "@/components/ErrorMessage";
import { GenerationStatus } from "@/components/common/GenerationStatus";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import { PracticeResultList } from "@/components/practice/PracticeResultList";
import type { RecommendationItem } from "@/data/recommendations";
import { getCourseLabel } from "@/data/courses";
import { getKnowledgeByCourse, getKnowledgeTitle } from "@/data/knowledge";
import { clearLastApiError, saveLastApiError } from "@/lib/api-diagnostics";
import { getClientProviderOverride } from "@/lib/client-provider";
import {
  getStoredAnswerDepth,
  saveStoredAnswerDepth,
} from "@/lib/preferences";
import {
  createPracticeGenerationId,
  getStoredPracticeGenerations,
  upsertStoredPracticeGeneration,
  type StoredPracticeGeneration,
} from "@/lib/practice-history";
import type { ParsedPracticeProblem } from "@/lib/practice-parser";
import { AgentStreamError, requestAgentStream } from "@/lib/read-agent-stream";
import { buildLatexDocument, createTexFileName } from "@/lib/latex-export";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import {
  getStoredLearningProfile,
  getStoredSessions,
  saveStoredLearningProfile,
  upsertToolContextSession,
} from "@/lib/storage";
import {
  answerDepthOptions,
  difficultyOptions,
  practiceOutputModeOptions,
  practiceStyleOptions,
  type AgentRequest,
  type AnswerDepth,
  type CourseId,
  type DetectedLanguage,
  type DifficultyId,
  type PracticeOutputMode,
  type PracticeStyleId,
  type ToolContext,
} from "@/types/learning";

const config = {
  taskType: "practice" as const,
  source: "practice" as const,
  title: "Practice Problems",
  description:
    "Generate original physics practice problems from a selected course, topic, difficulty, count, and source-style profile. The agent adapts between Chinese and English problem traditions based on the request.",
  submitLabel: "Generate problems",
  inputLabel: "Additional requirements",
  placeholder:
    "Examples: open-course problem-set style on electrostatic boundary-value problems; Chinese final-exam style on separation of variables.",
  emptyOutput:
    "Generated problems will appear here. Markdown, LaTeX, tables, and long formulas are supported.",
};

function languageLabel(language?: DetectedLanguage) {
  return language === "zh" ? "Chinese" : "English";
}

function createStoredApiError(message: string, status?: string) {
  return {
    message,
    status,
    occurredAt: Date.now(),
  };
}

export function AgentGenerator() {
  const router = useRouter();
  const [course, setCourse] = useState<CourseId | "">("");
  const [knowledgePoint, setKnowledgePoint] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyId>("medium");
  const [exerciseCount, setExerciseCount] = useState<3 | 5 | 10>(5);
  const [practiceOutputMode, setPracticeOutputMode] =
    useState<PracticeOutputMode>("hidden-answer");
  const [practiceStyle, setPracticeStyle] = useState<PracticeStyleId>("auto");
  const [answerDepth, setAnswerDepth] = useState<AnswerDepth>(() =>
    getStoredAnswerDepth(),
  );
  const [extraInput, setExtraInput] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkedSessionId, setLinkedSessionId] = useState("");
  const [practiceRecordId, setPracticeRecordId] = useState("");
  const [pendingRequest, setPendingRequest] = useState<AgentRequest | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const generatedAtRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const knowledgeOptions = useMemo(() => (course ? getKnowledgeByCourse(course) : []), [course]);
  const selectedKnowledgeTitle = getKnowledgeTitle(knowledgePoint);
  const includeHint = practiceOutputMode !== "questions-only";
  const includeAnswer =
    practiceOutputMode === "full-solution" || practiceOutputMode === "hidden-answer";
  const includeSolution =
    practiceOutputMode === "full-solution" || practiceOutputMode === "hidden-answer";
  const topic = extraInput.trim() || selectedKnowledgeTitle || (course ? getCourseLabel(course) : "");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRecommendations(
        getPersonalizedRecommendations({
          type: "practice",
          count: 3,
          sessions: getStoredSessions(),
          profile: getStoredLearningProfile(),
        }),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const latest = getStoredPracticeGenerations()[0];

      if (!latest) {
        return;
      }

      setPracticeRecordId(latest.id);
      setCourse(latest.course ?? "");
      setKnowledgePoint(latest.knowledgePoint ?? "");
      setDifficulty(latest.difficulty ?? "medium");
      setExerciseCount(latest.exerciseCount ?? 5);
      setPracticeOutputMode(latest.practiceOutputMode ?? "hidden-answer");
      setPracticeStyle(latest.practiceStyle ?? "auto");
      setAnswerDepth(latest.answerDepth ?? getStoredAnswerDepth());
      setExtraInput(latest.prompt);
      setContent(latest.content);
      generatedAtRef.current = latest.createdAt;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  function refreshRecommendations() {
    setRecommendations(
      getPersonalizedRecommendations({
        type: "practice",
        count: 3,
        sessions: getStoredSessions(),
        profile: getStoredLearningProfile(),
      }),
    );
  }

  function applyRecommendation(item: RecommendationItem) {
    setCourse(item.course);
    const matchedKnowledge = getKnowledgeByCourse(item.course).find(
      (knowledge) =>
        item.prompt.includes(knowledge.title) ||
        item.knowledgeTitle?.includes(knowledge.title) ||
        knowledge.alias?.some((alias) => item.prompt.toLowerCase().includes(alias.toLowerCase())),
    );

    setKnowledgePoint(matchedKnowledge?.id ?? "");
    setExtraInput(item.prompt);
  }

  function buildMessage(options: {
    resolvedCourse: CourseId;
    resolvedKnowledgePoint?: string;
    resolvedDifficulty: DifficultyId;
    resolvedCount: 3 | 5 | 10;
    resolvedLanguage: DetectedLanguage;
    resolvedPracticeStyle: PracticeStyleId;
  }) {
    const resolvedKnowledgeTitle = getKnowledgeTitle(options.resolvedKnowledgePoint ?? "");
    const targetTitle = extraInput.trim() || resolvedKnowledgeTitle || getCourseLabel(options.resolvedCourse);
    const difficultyLabel =
      difficultyOptions.find((item) => item.id === options.resolvedDifficulty)?.label ??
      "Intermediate";
    const styleLabel =
      practiceStyleOptions.find((item) => item.id === options.resolvedPracticeStyle)?.label ??
      "Auto";

    return [
      `Generate ${options.resolvedCount} original practice problems on: ${targetTitle}.`,
      `Course: ${getCourseLabel(options.resolvedCourse)}.`,
      resolvedKnowledgeTitle ? `Selected topic: ${resolvedKnowledgeTitle}.` : "",
      `Requested difficulty: ${difficultyLabel}.`,
      `Requested output language: ${languageLabel(options.resolvedLanguage)}.`,
      `Requested source style: ${styleLabel}.`,
      "Use the reference profile only as a style and training convention. Do not copy textbook, exam, MIT OCW, or open-course problem statements.",
      "Use Markdown. Use $...$ and $$...$$ for formulas; do not wrap formulas in code blocks.",
      extraInput.trim() ? `User's additional requirements:\n${extraInput.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function savePracticeResult(options: {
    recordId: string;
    title?: string;
    resultContent: string;
    status: StoredPracticeGeneration["status"];
    request: AgentRequest;
    promptText: string;
  }) {
    const now = Date.now();
    const createdAt = generatedAtRef.current || now;

    upsertStoredPracticeGeneration({
      id: options.recordId,
      title: options.title || topic || selectedKnowledgeTitle || "Practice problems",
      course: options.request.course,
      knowledgePoint: options.request.knowledgePoint,
      difficulty: options.request.difficulty,
      exerciseCount: options.request.exerciseCount,
      practiceOutputMode: options.request.practiceOutputMode,
      practiceStyle: options.request.practiceStyle,
      answerDepth: options.request.answerDepth,
      prompt: options.promptText,
      content: options.resultContent,
      status: options.status,
      createdAt,
      updatedAt: now,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const parsed = parseExerciseRequest(extraInput, course);

    if (parsed.conflict) {
      setError(
        `Course conflict: the selected course is "${getCourseLabel(parsed.conflict.selectedCourse)}", but the request appears to mention "${getCourseLabel(parsed.conflict.detectedCourse)}". Please adjust the course or clarify the request.`,
      );
      return;
    }

    const resolvedCourse = course || parsed.detectedCourse || "";
    const resolvedKnowledgePoint = knowledgePoint || parsed.detectedKnowledgeId || "";
    const resolvedDifficulty = parsed.difficulty ?? difficulty;
    const resolvedCount = parsed.count ?? exerciseCount;
    const resolvedLanguage = parsed.language ?? "en";
    const resolvedPracticeStyle =
      practiceStyle !== "auto" ? practiceStyle : parsed.practiceStyle ?? "auto";

    if (!resolvedCourse) {
      setError("Please select a course, or mention a course clearly in the request.");
      return;
    }

    if (!resolvedKnowledgePoint && !extraInput.trim()) {
      setError("Please select a topic, or enter a clear practice request.");
      return;
    }

    setCourse(resolvedCourse);
    setKnowledgePoint(resolvedKnowledgePoint);
    setDifficulty(resolvedDifficulty);
    setExerciseCount(resolvedCount);
    setPracticeStyle(resolvedPracticeStyle);

    setIsLoading(true);
    setError("");
    setContent("");
    setLinkedSessionId("");
    setPendingRequest(null);
    generatedAtRef.current = Date.now();
    const recordId = createPracticeGenerationId();
    setPracticeRecordId(recordId);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const message = buildMessage({
      resolvedCourse,
      resolvedKnowledgePoint,
      resolvedDifficulty,
      resolvedCount,
      resolvedLanguage,
      resolvedPracticeStyle,
    });
    const resultTitle =
      extraInput.trim() ||
      getKnowledgeTitle(resolvedKnowledgePoint) ||
      getCourseLabel(resolvedCourse);
    const baseRequest: AgentRequest = {
      message,
      module: "practice",
      course: resolvedCourse,
      taskType: config.taskType,
      knowledgePoint: resolvedKnowledgePoint || undefined,
      difficulty: resolvedDifficulty,
      exerciseCount: resolvedCount,
      includeAnswer,
      includeHint,
      includeSolution,
      practiceOutputMode,
      practiceStyle: resolvedPracticeStyle,
      detectedLanguage: resolvedLanguage,
      answerDepth,
      clientProvider: getClientProviderOverride(),
    };

    try {
      const intent = classifyAgentIntent(baseRequest);
      const memory = updateLearningMemory(createLearningMemory(), baseRequest, intent);
      saveStoredLearningProfile(
        updateLearningProfile(getStoredLearningProfile(), memory),
      );
      const requestBody: AgentRequest = {
        ...baseRequest,
        intent,
        memory,
        referenceProfile: memory.referenceProfile,
      };

      const result = await requestAgentStream(
        requestBody,
        setContent,
        {
          signal: abortController.signal,
          throttleMs: 80,
          idleTimeoutMs: resolvedCount === 10 ? 180000 : 120000,
        },
      );
      setContent(result);
      savePracticeResult({
        recordId,
        title: resultTitle,
        resultContent: result,
        status: "complete",
        request: requestBody,
        promptText: extraInput.trim() || message,
      });
      clearLastApiError();
    } catch (requestError) {
      const streamError =
        requestError instanceof AgentStreamError
          ? requestError
          : new AgentStreamError(requestError instanceof Error ? requestError.message : "Request failed.");

      if (streamError.partialContent) {
        setContent(streamError.partialContent);
        savePracticeResult({
          recordId,
          title: resultTitle,
          resultContent: streamError.partialContent,
          status: streamError.reason === "abort" ? "interrupted" : "error",
          request: baseRequest,
          promptText: extraInput.trim() || message,
        });
      }

      setPendingRequest(baseRequest);
      const messageText = streamError.message || "Generation interrupted. The current content has been preserved.";
      setError(messageText);
      saveLastApiError(createStoredApiError(messageText, streamError.reason));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  async function continueGeneration() {
    if (!pendingRequest || isLoading) {
      return;
    }

    const existingContent = content;
    setIsLoading(true);
    setError("");
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const continuationRequest: AgentRequest = {
        ...pendingRequest,
        clientProvider: getClientProviderOverride(),
        message: `The previous output stopped at the following point. Do not repeat existing content. Continue from the interruption point, preserving the original structure, numbering, language, notation, and LaTeX format.

Original request:
${pendingRequest.message}

Generated content:
${existingContent}`,
      };
      const continuation = await requestAgentStream(
        continuationRequest,
        (partial) => setContent(`${existingContent}${partial}`),
        {
          signal: abortController.signal,
          throttleMs: 80,
          idleTimeoutMs: pendingRequest.exerciseCount === 10 ? 180000 : 120000,
        },
      );

      setContent(`${existingContent}${continuation}`);
      savePracticeResult({
        recordId: ensurePracticeRecordId(),
        resultContent: `${existingContent}${continuation}`,
        status: "complete",
        request: pendingRequest,
        promptText: extraInput.trim() || pendingRequest.message,
      });
      setPendingRequest(null);
      clearLastApiError();
    } catch (requestError) {
      const streamError =
        requestError instanceof AgentStreamError
          ? requestError
          : new AgentStreamError(requestError instanceof Error ? requestError.message : "Request failed.");

      if (streamError.partialContent) {
        setContent(`${existingContent}${streamError.partialContent}`);
        savePracticeResult({
          recordId: ensurePracticeRecordId(),
          resultContent: `${existingContent}${streamError.partialContent}`,
          status: streamError.reason === "abort" ? "interrupted" : "error",
          request: pendingRequest,
          promptText: extraInput.trim() || pendingRequest.message,
        });
      }

      const messageText = streamError.message || "Generation interrupted. The current content has been preserved.";
      setError(messageText);
      saveLastApiError(createStoredApiError(messageText, streamError.reason));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  async function retryGeneration() {
    if (!pendingRequest || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setContent("");
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await requestAgentStream(
        { ...pendingRequest, clientProvider: getClientProviderOverride() },
        setContent,
        {
          signal: abortController.signal,
          throttleMs: 80,
          idleTimeoutMs: pendingRequest.exerciseCount === 10 ? 180000 : 120000,
        },
      );
      setContent(result);
      savePracticeResult({
        recordId: ensurePracticeRecordId(),
        resultContent: result,
        status: "complete",
        request: pendingRequest,
        promptText: extraInput.trim() || pendingRequest.message,
      });
      setPendingRequest(null);
      clearLastApiError();
    } catch (requestError) {
      const streamError =
        requestError instanceof AgentStreamError
          ? requestError
          : new AgentStreamError(
              requestError instanceof Error ? requestError.message : "Request failed.",
            );

      if (streamError.partialContent) {
        setContent(streamError.partialContent);
        savePracticeResult({
          recordId: ensurePracticeRecordId(),
          resultContent: streamError.partialContent,
          status: streamError.reason === "abort" ? "interrupted" : "error",
          request: pendingRequest,
          promptText: extraInput.trim() || pendingRequest.message,
        });
      }

      const messageText = streamError.message || "Generation interrupted. The current content has been preserved.";
      setError(messageText);
      saveLastApiError(createStoredApiError(messageText, streamError.reason));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  function ensurePracticeRecordId() {
    if (practiceRecordId) {
      return practiceRecordId;
    }

    const nextId = createPracticeGenerationId();
    setPracticeRecordId(nextId);
    return nextId;
  }

  function downloadLatex() {
    if (!content.trim()) {
      return;
    }

    const latex = buildLatexDocument(content, {
      title: "Physics Learning Agent Practice Problems",
      subtitle: topic ? `Topic: ${topic}` : undefined,
      generatedAt: generatedAtRef.current ? new Date(generatedAtRef.current) : new Date(),
    });
    const blob = new Blob([latex], {
      type: "application/x-tex;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = createTexFileName(topic);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function continueInChat(selectedItem?: ToolContext["selectedItem"]) {
    if (!content.trim() || !course) {
      return;
    }

    const toolContext: ToolContext = {
      source: config.source,
      course,
      knowledgeId: knowledgePoint || undefined,
      knowledgeTitle: selectedKnowledgeTitle || undefined,
      topic,
      taskTitle: config.title,
      userInput: buildMessage({
        resolvedCourse: course,
        resolvedKnowledgePoint: knowledgePoint,
        resolvedDifficulty: difficulty,
        resolvedCount: exerciseCount,
        resolvedLanguage: pendingRequest?.detectedLanguage ?? "en",
        resolvedPracticeStyle: practiceStyle,
      }),
      generatedContent: content,
      selectedItem,
      createdAt: generatedAtRef.current || 0,
    };
    const session = upsertToolContextSession({
      existingSessionId: linkedSessionId || undefined,
      toolContext,
      context: {
        course,
        taskType: selectedItem?.type === "problem" ? "solution-guide" : "qa",
        knowledgePoint: knowledgePoint || undefined,
        useRag: false,
        answerDepth,
        practiceStyle,
        detectedLanguage: pendingRequest?.detectedLanguage,
        referenceProfile: pendingRequest?.referenceProfile,
      },
    });

    setLinkedSessionId(session.id);
    router.push(`/chat?sessionId=${encodeURIComponent(session.id)}`);
  }

  function askPracticeProblem(problem: ParsedPracticeProblem) {
    continueInChat({
      type: "problem",
      title: problem.title,
      content: problem.rawContent,
      index: problem.index,
    });
  }

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-8 md:px-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
        <div className="space-y-2 border-b border-zinc-200 pb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{config.title}</h1>
          <p className="text-sm leading-6 text-zinc-600">{config.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <CourseSelector
            value={course}
            placeholder="Select a course"
            onChange={(nextCourse) => {
              setCourse(nextCourse);
              setKnowledgePoint("");
              setExtraInput("");
            }}
          />

          <label className="block space-y-2 text-sm font-medium text-zinc-800">
            <span>Topic</span>
            <select
              value={knowledgePoint}
              onChange={(event) => setKnowledgePoint(event.target.value)}
              disabled={!course}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              data-testid="knowledge-selector"
            >
              <option value="">{course ? "Select a topic" : "Select a course first"}</option>
              {knowledgeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium text-zinc-800">
              <span>Difficulty</span>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as DifficultyId)}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              >
                {difficultyOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium text-zinc-800">
              <span>Count</span>
              <select
                value={exerciseCount}
                onChange={(event) => setExerciseCount(Number(event.target.value) as 3 | 5 | 10)}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2 text-sm font-medium text-zinc-800">
            <span>Problem style</span>
            <select
              value={practiceStyle}
              onChange={(event) => setPracticeStyle(event.target.value as PracticeStyleId)}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              data-testid="practice-style"
            >
              {practiceStyleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm font-medium text-zinc-800">
            <span>Answer depth</span>
            <select
              value={answerDepth}
              onChange={(event) => {
                const nextDepth = event.target.value as AnswerDepth;
                setAnswerDepth(nextDepth);
                saveStoredAnswerDepth(nextDepth);
              }}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
            >
              {answerDepthOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm font-medium text-zinc-800">
            <span>{config.inputLabel}</span>
            <textarea
              value={extraInput}
              onChange={(event) => setExtraInput(event.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className="w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-950"
              data-testid="generator-prompt"
            />
          </label>

          <div className="rounded-md border border-zinc-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-800">Recommended prompts</p>
              <button
                type="button"
                onClick={refreshRecommendations}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {recommendations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyRecommendation(item)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-left text-xs leading-5 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-2 text-sm font-medium text-zinc-800">
            <span>Output mode</span>
            <select
              value={practiceOutputMode}
              onChange={(event) =>
                setPracticeOutputMode(event.target.value as PracticeOutputMode)
              }
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              data-testid="practice-output-mode"
            >
              {practiceOutputModeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type={isLoading ? "button" : "submit"}
            onClick={isLoading ? stopGeneration : undefined}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            data-testid="generator-submit"
          >
            <Send size={16} />
            {isLoading ? "Stop generation" : config.submitLabel}
          </button>
        </form>
      </section>

      <section className="min-h-[520px] min-w-0 overflow-x-hidden rounded-md border border-zinc-200 bg-white p-5 pb-12">
        <ErrorMessage message={error} />
        {pendingRequest ? (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void continueGeneration()}
              disabled={isLoading}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              Continue generation
            </button>
            <button
              type="button"
              onClick={() => void retryGeneration()}
              disabled={isLoading}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              Regenerate
            </button>
          </div>
        ) : null}

        {content ? (
          <div className="space-y-5">
            {isLoading ? (
              <GenerationStatus
                module="practice"
                taskType={config.taskType}
                hasContent
              />
            ) : null}
            {isLoading ? (
              <div data-testid="generator-streaming-content">
                <MarkdownRenderer content={content} streaming />
              </div>
            ) : (
              <PracticeResultList
                content={content}
                onAsk={askPracticeProblem}
              />
            )}

            {!isLoading ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadLatex}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                  data-testid="download-latex"
                >
                  <Download size={15} />
                  Download .tex
                </button>
                <button
                  type="button"
                  onClick={() =>
                    continueInChat({
                      type: "summary",
                      title: topic,
                      content,
                    })
                  }
                  className="inline-flex rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                >
                  Continue in chat
                </button>
              </div>
            ) : null}
          </div>
        ) : isLoading ? (
          <div className="flex min-h-[440px] items-center justify-center">
            <GenerationStatus module="practice" taskType={config.taskType} />
          </div>
        ) : (
          <div className="flex min-h-[440px] items-center justify-center text-center text-sm leading-6 text-zinc-500">
            {config.emptyOutput}
          </div>
        )}
      </section>
    </div>
  );
}
