"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send } from "lucide-react";

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
import { getCourseLabel } from "@/data/courses";
import { getKnowledgeByCourse, getKnowledgeTitle } from "@/data/knowledge";
import { AgentStreamError, requestAgentStream } from "@/lib/read-agent-stream";
import { clearLastApiError, saveLastApiError } from "@/lib/api-diagnostics";
import {
  getStoredAnswerDepth,
  saveStoredAnswerDepth,
} from "@/lib/preferences";
import type { ParsedPracticeProblem } from "@/lib/practice-parser";
import {
  getStoredLearningProfile,
  getStoredSessions,
  saveStoredLearningProfile,
  upsertToolContextSession,
} from "@/lib/storage";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import type { RecommendationItem } from "@/data/recommendations";
import {
  difficultyOptions,
  answerDepthOptions,
  practiceOutputModeOptions,
  type AnswerDepth,
  type CourseId,
  type DifficultyId,
  type AgentRequest,
  type PracticeOutputMode,
  type ToolContext,
} from "@/types/learning";

const config = {
  taskType: "practice" as const,
  source: "practice" as const,
  title: "练习题生成",
  description:
    "选择课程、知识点、难度和数量，生成贴近国内物理专业课后习题风格的原创变式题。",
  submitLabel: "生成练习题",
  inputLabel: "补充要求",
  placeholder: "例如：偏重边界条件分析，题目从基础到综合递进。",
  emptyOutput: "生成结果会显示在这里，支持 Markdown 和 LaTeX 公式。",
};

export function AgentGenerator() {
  const router = useRouter();
  const [course, setCourse] = useState<CourseId | "">("");
  const [knowledgePoint, setKnowledgePoint] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyId>("medium");
  const [exerciseCount, setExerciseCount] = useState<3 | 5 | 10>(5);
  const [practiceOutputMode, setPracticeOutputMode] =
    useState<PracticeOutputMode>("hidden-answer");
  const [answerDepth, setAnswerDepth] = useState<AnswerDepth>(() =>
    getStoredAnswerDepth(),
  );
  const [extraInput, setExtraInput] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkedSessionId, setLinkedSessionId] = useState("");
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
        knowledge.alias?.some((alias) => item.prompt.includes(alias)),
    );

    setKnowledgePoint(matchedKnowledge?.id ?? "");
    setExtraInput(item.prompt);
  }

  function buildMessage(options?: {
    resolvedKnowledgePoint?: string;
    resolvedDifficulty?: DifficultyId;
    resolvedCount?: 3 | 5 | 10;
  }) {
    const resolvedKnowledgeTitle = getKnowledgeTitle(
      options?.resolvedKnowledgePoint ?? knowledgePoint,
    );
    const targetTitle = extraInput.trim() || resolvedKnowledgeTitle;
    const requestedDifficulty = options?.resolvedDifficulty ?? difficulty;
    const requestedCount = options?.resolvedCount ?? exerciseCount;

    const outputInstruction: Record<PracticeOutputMode, string> = {
      "questions-only": "每道题只输出题目、训练目标、知识点和难度，不要输出提示、解析或答案。",
      "questions-hints": "每道题输出题目与解题提示，不要输出详细解析或最终答案。",
      "full-solution": "每道题输出提示、详细解析和最终答案。",
      "hidden-answer":
        "每道题输出提示、详细解析和最终答案；前端会默认折叠解析和答案。",
    };

    return [
      `请生成 ${requestedCount} 道关于「${targetTitle}」的原创练习题。`,
      `难度要求：${difficultyOptions.find((item) => item.id === requestedDifficulty)?.label ?? "中等"}。`,
      "题目风格：仿国内物理专业教材课后习题风格的原创变式题，不能照搬或声称来自具体教材。",
      "每道题要有明确训练目标，条件完整，符号清楚；涉及边值、本征值、规范、归一化、系综等问题时必须给出必要条件。",
      "公式统一使用 $...$ 或 $$...$$，不要用代码块包裹公式。",
      outputInstruction[practiceOutputMode],
      extraInput && selectedKnowledgeTitle ? `补充要求：${extraInput}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const parsed = parseExerciseRequest(extraInput, course);

    if (parsed.conflict) {
      setError(
        `课程信息存在冲突：当前选择“${getCourseLabel(parsed.conflict.selectedCourse)}”，但输入中识别到“${getCourseLabel(parsed.conflict.detectedCourse)}”。请修改课程选择或补充要求后再生成。`,
      );
      return;
    }

    const resolvedCourse = course || parsed.detectedCourse || "";
    const resolvedKnowledgePoint = knowledgePoint || parsed.detectedKnowledgeId || "";
    const resolvedDifficulty = parsed.difficulty ?? difficulty;
    const resolvedCount = parsed.count ?? exerciseCount;

    if (!resolvedCourse) {
      setError("请先选择课程，或在需求中明确写出课程名称。");
      return;
    }

    if (!resolvedKnowledgePoint && !extraInput.trim()) {
      setError(`请选择知识点，或输入一个明确的${config.inputLabel}。`);
      return;
    }

    setCourse(resolvedCourse);
    setKnowledgePoint(resolvedKnowledgePoint);
    setDifficulty(resolvedDifficulty);
    setExerciseCount(resolvedCount);

    setIsLoading(true);
    setError("");
    setContent("");
    setLinkedSessionId("");
    setPendingRequest(null);
    generatedAtRef.current = Date.now();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const message = buildMessage({
        resolvedKnowledgePoint,
        resolvedDifficulty,
        resolvedCount,
      });
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
        answerDepth,
      };
      const intent = classifyAgentIntent(baseRequest);
      const memory = updateLearningMemory(createLearningMemory(), baseRequest, intent);
      saveStoredLearningProfile(
        updateLearningProfile(getStoredLearningProfile(), memory),
      );
      const requestBody: AgentRequest = {
        ...baseRequest,
        intent,
        memory,
      };

      await requestAgentStream(
        requestBody,
        setContent,
        {
          signal: abortController.signal,
          throttleMs: 80,
          idleTimeoutMs: resolvedCount === 10 ? 180000 : 120000,
        },
      );
      clearLastApiError();
    } catch (requestError) {
      const streamError =
        requestError instanceof AgentStreamError
          ? requestError
          : new AgentStreamError(requestError instanceof Error ? requestError.message : "请求失败。");

      if (streamError.partialContent) {
        setContent(streamError.partialContent);
      }

      setPendingRequest({
        message: buildMessage({
          resolvedKnowledgePoint,
          resolvedDifficulty,
          resolvedCount,
        }),
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
        answerDepth,
      });
      const message = streamError.message || "生成中断，已保留当前内容。";
      setError(message);
      saveLastApiError({
        message,
        status: streamError.reason,
        occurredAt: Date.now(),
      });
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
        message: `上一段回答在以下位置中断。请不要重复已经写过的内容，从中断处继续完成回答，保持原来的结构、编号、符号和 LaTeX 格式。

用户原始请求：
${pendingRequest.message}

已生成内容：
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
      setPendingRequest(null);
      clearLastApiError();
    } catch (requestError) {
      const streamError =
        requestError instanceof AgentStreamError
          ? requestError
          : new AgentStreamError(requestError instanceof Error ? requestError.message : "请求失败。");

      if (streamError.partialContent) {
        setContent(`${existingContent}${streamError.partialContent}`);
      }

      const message = streamError.message || "生成中断，已保留当前内容。";
      setError(message);
      saveLastApiError({
        message,
        status: streamError.reason,
        occurredAt: Date.now(),
      });
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
      const result = await requestAgentStream(pendingRequest, setContent, {
        signal: abortController.signal,
        throttleMs: 80,
        idleTimeoutMs: pendingRequest.exerciseCount === 10 ? 180000 : 120000,
      });
      setContent(result);
      setPendingRequest(null);
      clearLastApiError();
    } catch (requestError) {
      const streamError =
        requestError instanceof AgentStreamError
          ? requestError
          : new AgentStreamError(
              requestError instanceof Error ? requestError.message : "请求失败。",
            );

      if (streamError.partialContent) {
        setContent(streamError.partialContent);
      }

      const message = streamError.message || "生成中断，已保留当前内容。";
      setError(message);
      saveLastApiError({
        message,
        status: streamError.reason,
        occurredAt: Date.now(),
      });
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
      userInput: buildMessage(),
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
            placeholder="请选择课程"
            onChange={(nextCourse) => {
              setCourse(nextCourse);
              setKnowledgePoint("");
              setExtraInput("");
            }}
          />

          <label className="block space-y-2 text-sm font-medium text-zinc-800">
            <span>知识点</span>
            <select
              value={knowledgePoint}
              onChange={(event) => setKnowledgePoint(event.target.value)}
              disabled={!course}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
              data-testid="knowledge-selector"
            >
              <option value="">{course ? "请选择知识点" : "请先选择课程"}</option>
              {knowledgeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium text-zinc-800">
              <span>难度</span>
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
              <span>数量</span>
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
            <span>回答深度</span>
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
              <p className="text-sm font-medium text-zinc-800">推荐主题</p>
              <button
                type="button"
                onClick={refreshRecommendations}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                <RefreshCw size={13} />
                换一批
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
            <span>输出方式</span>
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
            {isLoading ? "停止生成" : config.submitLabel}
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
              继续生成
            </button>
            <button
              type="button"
              onClick={() => void retryGeneration()}
              disabled={isLoading}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              重新生成
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
              到聊天页继续追问
            </button>
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
