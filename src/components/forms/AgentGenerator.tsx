"use client";

import dynamic from "next/dynamic";
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
import { ContentOutline } from "@/components/common/ContentOutline";
import { GenerationStatus } from "@/components/common/GenerationStatus";
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
import type { RecommendationItem, RecommendationType } from "@/data/recommendations";
import {
  difficultyOptions,
  answerDepthOptions,
  practiceOutputModeOptions,
  type AnswerDepth,
  type CourseId,
  type DifficultyId,
  type AgentRequest,
  type PracticeOutputMode,
  type TaskTypeId,
  type ToolContext,
} from "@/types/learning";

const MarkdownRenderer = dynamic(
  () => import("@/components/common/MarkdownRenderer").then((module) => module.MarkdownRenderer),
  {
    ssr: false,
    loading: () => <div className="text-sm text-zinc-500">正在排版公式...</div>,
  },
);

type GeneratorMode = "practice" | "types" | "review";

type AgentGeneratorProps = {
  mode: GeneratorMode;
};

const modeConfig: Record<
  GeneratorMode,
  {
    taskType: TaskTypeId;
    source: ToolContext["source"];
    title: string;
    description: string;
    submitLabel: string;
    inputLabel: string;
    placeholder: string;
    emptyOutput: string;
  }
> = {
  practice: {
    taskType: "practice",
    source: "practice",
    title: "练习题生成",
    description:
      "选择课程、知识点、难度和数量，生成贴近国内物理专业课后习题风格的原创变式题。",
    submitLabel: "生成练习题",
    inputLabel: "补充要求",
    placeholder: "例如：偏重边界条件分析，题目从基础到综合递进。",
    emptyOutput: "生成结果会显示在这里，支持 Markdown 和 LaTeX 公式。",
  },
  types: {
    taskType: "problem-types",
    source: "types",
    title: "题型梳理",
    description:
      "选择知识点或输入具体题型，像习题课一样梳理常见给题方式、建模步骤和原创例题。",
    submitLabel: "梳理题型",
    inputLabel: "题型目标",
    placeholder: "例如：球坐标下 Laplace 方程边值问题",
    emptyOutput: "题型特征、建模步骤、原创例题和解析会显示在这里。",
  },
  review: {
    taskType: "section-review",
    source: "review",
    title: "板块复习",
    description: "输入章节或板块名称，生成知识结构、主要公式、题型和复习路线。",
    submitLabel: "生成复习提纲",
    inputLabel: "复习板块",
    placeholder: "例如：Green 函数、Hamilton 力学、Maxwell 方程组、角动量",
    emptyOutput: "板块复习提纲会显示在这里。",
  },
};

const recommendationTypeByMode: Record<GeneratorMode, RecommendationType> = {
  practice: "practice",
  types: "problemType",
  review: "review",
};

export function AgentGenerator({ mode }: AgentGeneratorProps) {
  const config = modeConfig[mode];
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
          type: recommendationTypeByMode[mode],
          count: 3,
          sessions: getStoredSessions(),
          profile: getStoredLearningProfile(),
        }),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  function refreshRecommendations() {
    setRecommendations(
      getPersonalizedRecommendations({
        type: recommendationTypeByMode[mode],
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

    if (mode === "practice") {
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

    if (mode === "types") {
      return [
        `请梳理题型目标：「${targetTitle}」。`,
        "请像高校物理习题课教师一样讲解：这类题在课后习题中通常如何出现，已知条件怎样给出，标准解法是什么，容易错在哪里。",
        "必须给出仿国内教材课后习题风格的原创变式例题和解析，不能复制任何教材原题，不能声称来自某本教材。",
        "公式统一使用 $...$ 或 $$...$$，不要用代码块包裹公式。",
      ].join("\n");
    }

    return [
      `请把「${targetTitle}」整理成板块复习提纲。`,
      "必须包含：板块定位、知识结构、学习顺序、核心公式、典型题型、章节联系、常见误区和复习建议。",
      "公式统一使用 $...$ 或 $$...$$，不要用代码块包裹公式。",
    ].join("\n");
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
        module: mode,
        course: resolvedCourse,
        taskType: config.taskType,
        knowledgePoint: resolvedKnowledgePoint || undefined,
        difficulty: resolvedDifficulty,
        exerciseCount: resolvedCount,
        includeAnswer,
        includeHint,
        includeSolution,
        practiceOutputMode: mode === "practice" ? practiceOutputMode : undefined,
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
        module: mode,
        course: resolvedCourse,
        taskType: config.taskType,
        knowledgePoint: resolvedKnowledgePoint || undefined,
        difficulty: resolvedDifficulty,
        exerciseCount: resolvedCount,
        includeAnswer,
        includeHint,
        includeSolution,
        practiceOutputMode: mode === "practice" ? practiceOutputMode : undefined,
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

          {mode === "practice" ? (
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
          ) : null}

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
              rows={mode === "practice" ? 4 : 5}
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

          {mode === "practice" ? (
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
          ) : null}

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
                module={mode}
                taskType={config.taskType}
                hasContent
              />
            ) : null}
            {isLoading ? (
              <pre
                className="whitespace-pre-wrap break-words font-sans text-[0.95rem] leading-7 text-zinc-800"
                data-testid="generator-streaming-content"
              >
                {content}
              </pre>
            ) : mode === "practice" ? (
              <PracticeResultList
                content={content}
                onAsk={askPracticeProblem}
              />
            ) : (
              <div className="space-y-4" data-testid="generator-result">
                <ContentOutline content={content} />
                <MarkdownRenderer content={content} />
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                continueInChat({
                  type: mode === "types" ? "problemType" : mode === "practice" ? "summary" : "section",
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
            <GenerationStatus module={mode} taskType={config.taskType} />
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
