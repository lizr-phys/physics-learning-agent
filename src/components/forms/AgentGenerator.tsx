"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Send } from "lucide-react";

import { parseExerciseRequest } from "@/agent/exercise-parser";
import { classifyAgentIntent } from "@/agent/intent-classifier";
import {
  updateLearningProfile,
} from "@/agent/memory-manager";
import { CourseSelector } from "@/components/CourseSelector";
import { ErrorMessage } from "@/components/ErrorMessage";
import { GenerationStatus } from "@/components/common/GenerationStatus";
import { ImageAttachmentInput, ImageGallery } from "@/components/common/ImageAttachments";
import { PracticeResultList } from "@/components/practice/PracticeResultList";
import type { RecommendationItem } from "@/data/recommendations";
import { getCourseLabel } from "@/data/courses";
import { getKnowledgeByCourse, getKnowledgeTitle } from "@/data/knowledge";
import { clearLastApiError, saveLastApiError } from "@/lib/api-diagnostics";
import { getClientProviderOverride } from "@/lib/client-provider";
import { getWorkspaceIdentity, isWorkspaceCurrent, workspaceStorage } from "@/lib/workspace-storage";
import {
  getStoredAnswerDepth,
  saveStoredAnswerDepth,
} from "@/lib/preferences";
import {
  createPracticeGenerationId,
  getStoredPracticeGenerations,
  updateStoredPracticeAssessment,
  upsertStoredPracticeGeneration,
  type StoredPracticeGeneration,
} from "@/lib/practice-history";
import type { ParsedPracticeProblem } from "@/lib/practice-parser";
import { practiceProgress, safePracticeRequest, type PracticeTaskProgress } from "@/lib/practice-task";
import { createDraftCheckpoint } from "@/lib/draft-checkpoint";
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
  type PracticeAssessment,
  type PracticeAssessmentStatus,
  type PracticeStyleId,
  type ToolContext,
  type GenerationDiagnostics,
  type ImageAttachment,
} from "@/types/learning";

const config = {
  taskType: "practice" as const,
  source: "practice" as const,
  title: "Practice Problems",
  description:
    "Create original problems from a topic or an image.",
  submitLabel: "Generate problems",
  inputLabel: "Practice request",
  placeholder:
    "Describe a topic, or attach a problem and ask for variations…",
  emptyOutput:
    "Your practice set will appear here.",
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
  const [exerciseCount, setExerciseCount] = useState<number>(5);
  const [practiceOutputMode, setPracticeOutputMode] =
    useState<PracticeOutputMode>("hidden-answer");
  const [practiceStyle, setPracticeStyle] = useState<PracticeStyleId>("auto");
  const [answerDepth, setAnswerDepth] = useState<AnswerDepth>(() =>
    getStoredAnswerDepth(),
  );
  const [extraInput, setExtraInput] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [sourceImages, setSourceImages] = useState<ImageAttachment[]>([]);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkedSessionId, setLinkedSessionId] = useState("");
  const [practiceRecordId, setPracticeRecordId] = useState("");
  const [problemAssessments, setProblemAssessments] = useState<
    Record<string, PracticeAssessment>
  >({});
  const [pendingRequest, setPendingRequest] = useState<AgentRequest | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const generatedAtRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [taskProgress, setTaskProgress] = useState<PracticeTaskProgress | null>(null);
  const [generationStage, setGenerationStage] = useState("");
  const draftCheckpointRef = useRef<ReturnType<typeof createDraftCheckpoint<{ content: string; task: PracticeTaskProgress }>> | null>(null);
  const stopGenerationRef = useRef<((reason?: string) => void) | null>(null);

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
      setImages(latest.originalRequest?.images ?? []);
      setSourceImages(latest.originalRequest?.images ?? []);
      setContent(latest.content);
      setProblemAssessments(latest.problemAssessments ?? {});
      setTaskProgress(latest.task ?? null);
      if (latest.status !== "complete") {
        setPendingRequest(latest.originalRequest ?? { message: latest.prompt, module: "practice", taskType: "practice", course: latest.course, knowledgePoint: latest.knowledgePoint, difficulty: latest.difficulty, exerciseCount: latest.exerciseCount, practiceOutputMode: latest.practiceOutputMode, practiceStyle: latest.practiceStyle, answerDepth: latest.answerDepth });
        setError("This practice set is unfinished. Continue generation to restore the missing problems.");
      }
      generatedAtRef.current = latest.createdAt;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      stopGenerationRef.current?.("page_left");
      stopGenerationRef.current = null;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const preserve = (event: Event) => { stopGenerationRef.current?.(event.type === "pagehide" ? "page_left" : "workspace_changed"); };
    window.addEventListener("pagehide", preserve);
    window.addEventListener("pla:workspace-will-change", preserve);
    return () => { window.removeEventListener("pagehide", preserve); window.removeEventListener("pla:workspace-will-change", preserve); };
  }, []);

  useEffect(() => {
    const refreshVisible = () => {
      if (abortControllerRef.current) return;
      const records = getStoredPracticeGenerations();
      const visible = records.find(record => record.id === practiceRecordId) ?? records[0];
      if (!visible) { setContent(""); setProblemAssessments({}); setTaskProgress(null); setPendingRequest(null); return; }
      setPracticeRecordId(visible.id);
      setContent(visible.content);
      setSourceImages(visible.originalRequest?.images ?? []);
      setProblemAssessments(visible.problemAssessments ?? {});
      setTaskProgress(visible.task ?? null);
      setPendingRequest(visible.status !== "complete" ? visible.originalRequest ?? { message: visible.prompt, module: "practice", taskType: "practice", course: visible.course, exerciseCount: visible.exerciseCount, practiceOutputMode: visible.practiceOutputMode } : null);
    };
    for (const event of ["pla:practice-history-changed", "pla:workspace-loaded", "storage"]) window.addEventListener(event, refreshVisible);
    return () => { for (const event of ["pla:practice-history-changed", "pla:workspace-loaded", "storage"]) window.removeEventListener(event, refreshVisible); };
  }, [practiceRecordId]);

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
    resolvedCount: number;
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
      images.length ? "Use the attached image to identify the concepts, diagrams and conditions. Create new variations; do not copy the pictured problem. Ask for clarification if any necessary value or label is unreadable." : "",
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
    task?: PracticeTaskProgress;
    generation?: GenerationDiagnostics;
  }) {
    const now = Date.now();
    const createdAt = generatedAtRef.current || now;
    const existing = getStoredPracticeGenerations().find(
      (item) => item.id === options.recordId,
    );

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
      problemAssessments: existing?.problemAssessments,
      assessmentTombstones: existing?.assessmentTombstones,
      task: options.task ?? practiceProgress(options.request, options.resultContent, options.recordId, true),
      originalRequest: safePracticeRequest(options.request),
      generation: options.generation ?? existing?.generation,
      generationAttempts: options.generation ? [...(existing?.generationAttempts ?? []).filter(attempt => attempt.requestId !== options.generation?.requestId), options.generation] : existing?.generationAttempts,
      createdAt,
      updatedAt: now,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading || imagesBusy) {
      return;
    }

    const parsed = parseExerciseRequest(extraInput, course);
    const writtenCount = extraInput.match(/(\d+)\s*(?:problems?|exercises?|questions?|道题|道|题)/i)?.[1];
    if (writtenCount && (Number(writtenCount) < 1 || Number(writtenCount) > 20)) { setError("Generate between 1 and 20 problems in one set."); return; }

    if (parsed.conflict) {
      setError(
        `Course conflict: the selected course is "${getCourseLabel(parsed.conflict.selectedCourse)}", but the request appears to mention "${getCourseLabel(parsed.conflict.detectedCourse)}". Please adjust the course or clarify the request.`,
      );
      return;
    }

    const resolvedCourse = course || parsed.detectedCourse || (images.length ? "general-physics" : "");
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

    if (!resolvedKnowledgePoint && !extraInput.trim() && !images.length) {
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
    setProblemAssessments({});
    setLinkedSessionId("");
    setPendingRequest(null);
    generatedAtRef.current = Date.now();
    const recordId = createPracticeGenerationId();
    setPracticeRecordId(recordId);
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
      model: workspaceStorage().getItem("pla.deepseek.model") ?? "deepseek-flash",
      images: images.length ? images : undefined,
    };

    await runPracticeGeneration(baseRequest, recordId, resultTitle);
  }

  async function runPracticeGeneration(baseRequest: AgentRequest, recordId: string, title?: string, resumeContent?: string) {
    const identity = getWorkspaceIdentity();
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    const current = () => isWorkspaceCurrent(identity) && abortControllerRef.current === abortController;
    let effectiveRequest: AgentRequest = {
      ...baseRequest,
      intent: classifyAgentIntent(baseRequest),
      clientProvider: getClientProviderOverride(),
      conversationId: recordId,
      assistantMessageId: `${recordId}:answer`,
      requestId: crypto.randomUUID(),
      practiceTask: { setId: recordId, resumeContent },
    };
    let latestContent = resumeContent ?? "";
    let latestTask = practiceProgress(effectiveRequest, latestContent, recordId, true);
    const startedAt = Date.now();
    let generation: GenerationDiagnostics = { requestId: effectiveRequest.requestId!, provider: effectiveRequest.clientProvider?.provider ?? "server-default", model: effectiveRequest.clientProvider?.model ?? effectiveRequest.model, intent: effectiveRequest.intent, startedAt, terminal: "interrupted", reason: "checkpoint" };
    setIsLoading(true);
    setError("");
    setSourceImages(baseRequest.images ?? []);
    setGenerationStage("plan-task");
    setTaskProgress(latestTask);
    let storageFailure = false;
    const storageMessage = "The browser could not save this practice set. The current text is still available; download it before leaving and free storage before retrying.";
    const save = (resultContent: string, status: StoredPracticeGeneration["status"]) => { try { savePracticeResult({
      recordId, title, resultContent, status, request: effectiveRequest,
      promptText: extraInput.trim() || baseRequest.message, task: latestTask, generation: { ...generation, durationMs: Date.now() - startedAt, outputChars: resultContent.length },
    }); return true; } catch { storageFailure = true; setError(storageMessage); abortController.abort(); return false; } };
    const checkpoint = createDraftCheckpoint<{ content: string; task: PracticeTaskProgress }>(snapshot => {
      latestTask = snapshot.task;
      save(snapshot.content, "interrupted");
    }, current);
    draftCheckpointRef.current?.discard();
    draftCheckpointRef.current = checkpoint;
    stopGenerationRef.current = (reason = "user_cancelled") => {
      if (current()) {
        generation = { ...generation, terminal: "cancelled", reason };
        checkpoint.flush();
        save(latestContent, "interrupted");
      }
      abortController.abort();
    };
    try {
      if (!save(latestContent, "interrupted")) { setPendingRequest(safePracticeRequest(effectiveRequest)); return; }
      const result = await requestAgentStream(effectiveRequest, partial => {
        if (!current()) return;
        latestContent = partial;
        setContent(partial);
        checkpoint.update({ content: partial, task: latestTask });
      }, {
        signal: abortController.signal, throttleMs: 80, idleTimeoutMs: 120_000,
        onEvent: event => {
          if (!current()) return;
          if (event.type === "delta" && event.text.trim() && generation.firstTokenMs === undefined) generation.firstTokenMs = Date.now() - startedAt;
          if (event.type === "stage") setGenerationStage(event.stage);
          if (event.type === "context") {
            effectiveRequest = { ...effectiveRequest, ...event.context };
            if (event.context.course) setCourse(event.context.course);
            if (event.context.knowledgePoint) setKnowledgePoint(event.context.knowledgePoint);
          }
          if (event.type === "practice") {
            latestTask = event.task;
            setTaskProgress(event.task);
            checkpoint.update({ content: event.content, task: event.task });
            checkpoint.flush();
          }
          if (event.type === "memory") { try { saveStoredLearningProfile(updateLearningProfile(getStoredLearningProfile(), event.memory)); } catch { setError("The set finished, but learning preferences could not be saved. Download the set before leaving."); } }
          if (event.type === "complete" || event.type === "interrupted" || event.type === "truncated" || event.type === "cancelled") generation = { ...generation, terminal: event.type, reason: "reason" in event ? event.reason : undefined, finishReason: event.type === "complete" ? event.finishReason : undefined, usage: "usage" in event ? event.usage : undefined };
        },
      });
      if (!current()) return;
      latestContent = result;
      latestTask = practiceProgress(effectiveRequest, result, recordId, true);
      setContent(result);
      setTaskProgress(latestTask);
      checkpoint.discard();
      if (latestTask.completedProblemIds.length !== latestTask.targetCount) {
        generation = { ...generation, terminal: "interrupted", reason: "practice_contract_incomplete" };
        if (!save(result, "interrupted")) { setPendingRequest(safePracticeRequest(effectiveRequest)); return; }
        setPendingRequest(safePracticeRequest(effectiveRequest));
        setError(`Only ${latestTask.completedProblemIds.length} of ${latestTask.targetCount} problems passed structure checks. Continue generation to finish the set.`);
      } else {
        generation = { ...generation, terminal: "complete", reason: undefined };
        if (!save(result, "complete")) { setPendingRequest(safePracticeRequest(effectiveRequest)); return; }
        setPendingRequest(null);
        try { clearLastApiError(); } catch { /* Task output remains visible when diagnostics storage is unavailable. */ }
      }
    } catch (requestError) {
      if (!current()) { checkpoint.discard(); return; }
      const streamError = requestError instanceof AgentStreamError ? requestError : new AgentStreamError(requestError instanceof Error ? requestError.message : "Request failed.");
      latestContent = streamError.partialContent || latestContent;
      latestTask = practiceProgress(effectiveRequest, latestContent, recordId, true);
      generation = { ...generation, terminal: streamError.reason === "abort" ? "cancelled" : streamError.reason === "length" ? "truncated" : "interrupted", reason: generation.reason !== "checkpoint" ? generation.reason : streamError.reason };
      setContent(latestContent);
      setTaskProgress(latestTask);
      checkpoint.discard();
      if (storageFailure) { setPendingRequest(safePracticeRequest(effectiveRequest)); setError(storageMessage); return; }
      if (!save(latestContent, "interrupted")) { setPendingRequest(safePracticeRequest(effectiveRequest)); return; }
      setPendingRequest(safePracticeRequest(effectiveRequest));
      const messageText = streamError.message || "Generation interrupted. The current content has been preserved.";
      setError(messageText);
      try { saveLastApiError(createStoredApiError(messageText, streamError.reason)); } catch { /* Secondary diagnostics must not hide the retained task output. */ }
    } finally {
      if (current()) {
        checkpoint.flush();
        abortControllerRef.current = null;
        draftCheckpointRef.current = null;
        stopGenerationRef.current = null;
        setIsLoading(false);
      }
    }
  }

  async function continueGeneration() {
    if (!pendingRequest || isLoading) return;
    await runPracticeGeneration(pendingRequest, ensurePracticeRecordId(), undefined, content);
  }

  async function retryGeneration() {
    if (!pendingRequest || isLoading) return;
    // Retry the unfinished batch; completed problem IDs and assessments stay intact.
    await runPracticeGeneration(pendingRequest, ensurePracticeRecordId(), undefined, content);
  }

  function stopGeneration() {
    stopGenerationRef.current?.();
  }

  function ensurePracticeRecordId() {
    if (practiceRecordId) {
      return practiceRecordId;
    }

    const nextId = createPracticeGenerationId();
    setPracticeRecordId(nextId);
    return nextId;
  }

  function assessProblem(problemIndex: number | string, status?: PracticeAssessmentStatus, notes?: { attemptDraft?: string; stuckNote?: string }) {
    if (!practiceRecordId) {
      return;
    }

    try { setProblemAssessments(updateStoredPracticeAssessment(practiceRecordId, problemIndex, status, notes)); }
    catch { setError("This attempt could not be saved. Free browser storage and try again; the generated set remains visible."); }
  }

  function downloadLatex() {
    if (!content.trim()) {
      return;
    }

    const latex = buildLatexDocument(content.replace(/<!--\s*pla:problem-id\s+[^>]+-->/g, ""), {
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
      images: sourceImages.length ? sourceImages : undefined,
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
    <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-6 md:px-6 lg:grid-cols-[310px_minmax(0,1fr)]">
      <section className="min-w-0">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{config.title}</h1>
          <p className="text-sm leading-6 text-zinc-600">{config.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block space-y-2 text-sm font-medium text-zinc-800">
            <span>{config.inputLabel}</span>
            <textarea id="practice-request-input" value={extraInput} onChange={event => setExtraInput(event.target.value)} placeholder={config.placeholder} rows={3} className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-950" data-testid="generator-prompt" />
          </label>
          <ImageAttachmentInput images={images} onChange={setImages} onBusyChange={setImagesBusy} disabled={isLoading} pasteTargetId="practice-request-input" />
          <CourseSelector
            value={course}
            placeholder="Select a course"
            onChange={(nextCourse) => {
              setCourse(nextCourse);
              setKnowledgePoint("");
              setExtraInput("");
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2 text-sm font-medium text-zinc-800">
              <span>Count</span>
              <select aria-label="Count" value={exerciseCount} onChange={event => setExerciseCount(Number(event.target.value))} className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm">
                {[3,5,10,...(![3,5,10].includes(exerciseCount) ? [exerciseCount] : [])].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium text-zinc-800">
              <span>Output mode</span>
              <select aria-label="Output mode" value={practiceOutputMode} onChange={event => setPracticeOutputMode(event.target.value as PracticeOutputMode)} className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs" data-testid="practice-output-mode">
                {practiceOutputModeOptions.map(option => <option key={option.id} value={option.id}>{option.id === "hidden-answer" ? "Hidden answers" : option.label}</option>)}
              </select>
            </label>
          </div>
          <button type={isLoading ? "button" : "submit"} disabled={imagesBusy && !isLoading} onClick={isLoading ? stopGeneration : undefined} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400" data-testid="generator-submit">
            <Send size={16} />{isLoading ? "Stop generation" : config.submitLabel}
          </button>
          <details className="text-sm text-zinc-600">
          <summary className="cursor-pointer py-2">Options</summary>
          <div className="mt-2 space-y-3">
          <label className="mt-2 block space-y-2 text-sm font-medium text-zinc-800">
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

          <div>
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

          <div className="pt-2">
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
          </div>
          </details>
        </form>
      </section>

      <section className="min-h-60 min-w-0 overflow-x-hidden border-t border-zinc-200 pt-5 pb-12 lg:border-t-0 lg:border-l lg:pl-6">
        <ErrorMessage message={error} />
        {sourceImages.length ? <details className="mb-4 text-xs text-zinc-500"><summary className="cursor-pointer py-2">Source images</summary><ImageGallery images={sourceImages} compact /></details> : null}
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
                stage={generationStage}
                completedProblems={taskProgress?.completedProblemIds.length}
                totalProblems={taskProgress?.targetCount}
              />
            ) : null}
            <div data-testid={isLoading ? "generator-streaming-content" : undefined}>
              <PracticeResultList
                content={content}
                onAsk={askPracticeProblem}
                assessments={problemAssessments}
                onAssess={assessProblem}
                outputMode={practiceOutputMode}
                streaming={isLoading}
              />
            </div>

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
            <GenerationStatus module="practice" taskType={config.taskType} stage={generationStage} completedProblems={taskProgress?.completedProblemIds.length} totalProblems={taskProgress?.targetCount} />
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
