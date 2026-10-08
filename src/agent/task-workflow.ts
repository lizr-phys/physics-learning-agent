import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { allocateRequestContext, estimateContextTokens, selectContextExcerpt } from "@/agent/context-manager";

import { commitLearningMemory } from "@/agent/memory-manager";
import { getModelConfig } from "@/agent/model-config";
import { appendResponseSuffix } from "@/agent/response-post-processor";
import type { PreparedAgentRequest } from "@/agent/workflow";
import { DeepSeekError, openProviderEventStream } from "@/lib/deepseek";
import { encodeGenerationEvent, type GenerationBinding, type GenerationPayload } from "@/lib/generation-stream";
import { canonicalPracticeProblem, hasUnclosedPracticeMarkup, parsePracticeProblems, validatePracticeProblem } from "@/lib/practice-parser";
import { practiceOutputMode, practiceProgress } from "@/lib/practice-task";
import type { ProviderEvent } from "@/lib/provider-sse";
import type { AgentRequest, TokenUsage } from "@/types/learning";

export const taskBudget = { batchSize: 2, maxRepairs: 1, maxDurationMs: 180_000, maxOutputTokens: 24_000 } as const;
type Terminal = Exclude<ProviderEvent, { type: "delta" | "activity" }>;
type TaskRuntime = {
  emit: (event: GenerationPayload) => void;
  signal: AbortSignal;
  startedAt: number;
  maxDurationMs: number;
  maxOutputTokens: number;
};
const State = Annotation.Root({
  input: Annotation<AgentRequest>(),
  runtime: Annotation<TaskRuntime>(),
  practice: Annotation<boolean>(),
  setId: Annotation<string>(),
  targetCount: Annotation<number>(),
  completed: Annotation<Record<number, string>>(),
  batchNumbers: Annotation<number[]>(),
  candidate: Annotation<string>(),
  content: Annotation<string>(),
  calls: Annotation<number>(),
  repairs: Annotation<number>(),
  tokens: Annotation<number>(),
  usage: Annotation<TokenUsage>(),
  terminal: Annotation<Terminal | undefined>(),
  issues: Annotation<string[]>(),
  halt: Annotation<string | undefined>(),
});
type TaskState = typeof State.State;

function remaining(state: TaskState) {
  return Array.from({ length: state.targetCount }, (_, index) => index + 1).filter(index => !state.completed[index]);
}
function savedContent(completed: Record<number, string>) {
  return Object.entries(completed).sort(([a], [b]) => Number(a) - Number(b)).map(([, content]) => content).join("\n\n");
}
function publishProgress(state: TaskState, content: string) {
  state.runtime.emit({ type: "practice", task: practiceProgress(state.input, savedContent(state.completed), state.setId, true), content });
}
function budgetReason(state: TaskState) {
  if (state.runtime.signal.aborted) return "user_cancelled";
  if (Date.now() - state.runtime.startedAt >= state.runtime.maxDurationMs) return "task_timeout";
  if (state.tokens >= state.runtime.maxOutputTokens) return "task_output_budget";
  if (state.calls >= Math.ceil(state.targetCount / taskBudget.batchSize) + taskBudget.maxRepairs) return "task_call_budget";
  return undefined;
}
function planTask(state: TaskState) {
  state.runtime.emit({ type: "stage", stage: "prepare-generation" });
  const practice = state.input.module === "practice" || state.input.taskType === "practice" || state.input.intent === "exercise_generation";
  const input = practice ? { ...state.input, taskType: "practice" as const } : state.input;
  const setId = input.practiceTask?.setId ?? `practice-${crypto.randomUUID()}`;
  const targetCount = Math.max(1, Math.min(20, Math.round(input.exerciseCount ?? 5)));
  const completed: Record<number, string> = {};
  if (practice && input.practiceTask?.resumeContent) {
    const blocks = parsePracticeProblems(input.practiceTask.resumeContent, { setId });
    const seen = new Set<number>();
    for (const block of blocks) {
      if (seen.has(block.index) || block.index < 1 || block.index > targetCount) continue;
      seen.add(block.index);
      if (validatePracticeProblem(block, practiceOutputMode(input), true).valid) {
        completed[block.index] = canonicalPracticeProblem(block, `${setId}:problem:${block.index}`, block.index);
      }
    }
  }
  const content = savedContent(completed);
  const next = { ...state, input: { ...input, exerciseCount: practice ? targetCount : input.exerciseCount }, practice, setId, targetCount, completed, content };
  if (practice) publishProgress(next, content);
  return { input: next.input, practice, setId, targetCount, completed, content, calls: 0, repairs: 0, tokens: 0, usage: {}, batchNumbers: [], candidate: "", issues: [] };
}

function batchMessage(state: TaskState, numbers: number[], repair: boolean) {
  const mode = practiceOutputMode(state.input);
  return [
    state.input.message,
    `Batch contract: generate exactly ${numbers.length} original problems, numbered ${numbers.join(", ")}. These are the only problem numbers to output.`,
    `The complete set has ${state.targetCount} problems. Completed problem IDs: ${Object.keys(state.completed).map(index => `${state.setId}:problem:${index}`).join(", ") || "none"}. Do not reproduce completed problems.`,
    "Use headings `### Problem N` (or `### 题目 N`) and these separate bold field labels: Training goal, Conditions, Problem, Topics, Difficulty.",
    mode === "questions-only" ? "Do not include Hint, Solution, or Answer." : "Include a separate Hint field.",
    mode === "hidden-answer" || mode === "full-solution" ? "Include separate, nonempty Solution and Answer fields. Solutions must explain steps; answers must give the result. Include Common mistakes if useful." : "Do not include Solution or Answer.",
    "Conditions must state the system, given quantities, domain and necessary boundary/initial/normalization/ensemble assumptions. Do not invent a textbook source or copy a public problem.",
    "Preserve the requested response language. Do not wrap the entire response in a code fence.",
    repair ? `One format repair is available. Regenerate ONLY the missing/incomplete problem numbers above. Previous validation issues: ${state.issues.join(", ")}. Previous incomplete draft:\n${selectContextExcerpt(state.candidate, 12_000)}` : "",
  ].filter(Boolean).join("\n\n");
}

async function generate(state: TaskState, repair = false) {
  const halt = budgetReason(state);
  if (halt) return { halt };
  const numbers = state.practice ? repair ? state.batchNumbers.filter(index => !state.completed[index]) : remaining(state).slice(0, taskBudget.batchSize) : [];
  if (state.practice && !numbers.length) return { candidate: "", batchNumbers: [], terminal: { type: "complete" as const, finishReason: "already_ready" } };
  state.runtime.emit({ type: "stage", stage: repair ? "repair" : "generate" });
  const input = state.practice ? allocateRequestContext({ ...state.input, exerciseCount: numbers.length, message: batchMessage(state, numbers, repair), practiceTask: undefined, contextBudget: undefined }) : state.input;
  let candidate = "";
  let terminal: Terminal | undefined;
  const maxOutputTokens = Math.max(1, Math.min(getModelConfig(input).max_tokens, state.practice ? 4_800 : 8_000, state.runtime.maxOutputTokens - state.tokens));
  const completedContent = savedContent(state.completed);
  if (state.practice) {
    publishProgress(state, completedContent);
    if (completedContent) state.runtime.emit({ type: "delta", seq: 1, text: "\n\n" });
  }
  const callController = new AbortController();
  const provider = await openProviderEventStream(input, AbortSignal.any([state.runtime.signal, callController.signal]), {
    maxOutputTokens,
    totalTimeoutMs: Math.max(1, state.runtime.maxDurationMs - (Date.now() - state.runtime.startedAt)),
  });
  try {
    for await (const event of provider) {
      if (event.type === "delta") {
        if (estimateContextTokens(candidate + event.text) > maxOutputTokens) {
          let left = 0, right = event.text.length;
          while (left < right) {
            const middle = Math.ceil((left + right) / 2);
            if (estimateContextTokens(candidate + event.text.slice(0, middle)) <= maxOutputTokens) left = middle;
            else right = middle - 1;
          }
          const text = event.text.slice(0, left);
          candidate += text;
          if (text) state.runtime.emit({ type: "delta", seq: 1, text });
          terminal = { type: "truncated", reason: "task_output_budget", retryable: true };
          callController.abort();
          break;
        }
        candidate += event.text;
        state.runtime.emit({ type: "delta", seq: state.calls + 1, text: event.text });
      } else if (event.type === "activity") state.runtime.emit(event);
      else terminal = event;
    }
  } finally { await provider.return(undefined); }
  const consumed = terminal?.usage?.outputTokens ?? maxOutputTokens;
  const usage = {
    inputTokens: terminal?.usage?.inputTokens === undefined || (state.calls > 0 && state.usage.inputTokens === undefined) ? undefined : (state.usage.inputTokens ?? 0) + terminal.usage.inputTokens,
    outputTokens: terminal?.usage?.outputTokens === undefined || (state.calls > 0 && state.usage.outputTokens === undefined) ? undefined : (state.usage.outputTokens ?? 0) + terminal.usage.outputTokens,
  };
  return { candidate, batchNumbers: numbers, terminal, calls: state.calls + 1, repairs: state.repairs + (repair ? 1 : 0), tokens: state.tokens + consumed, usage };
}

function validateOutput(state: TaskState) {
  state.runtime.emit({ type: "stage", stage: "validate" });
  if (state.halt) return {};
  if (!state.practice) {
    const halt = !state.candidate.trim() ? "empty_response" : state.input.intent !== "general_question" && hasUnclosedPracticeMarkup(state.candidate) ? "incomplete_format" : undefined;
    return { content: state.candidate, halt: state.terminal?.type === "complete" ? halt : state.terminal?.type === "cancelled" ? "user_cancelled" : state.terminal && "reason" in state.terminal ? state.terminal.reason : "unexpected_eof" };
  }
  const completed = { ...state.completed };
  const problems = parsePracticeProblems(state.candidate, { setId: state.setId });
  const issues: string[] = [];
  const counts = new Map<number, number>();
  for (const problem of problems) counts.set(problem.index, (counts.get(problem.index) ?? 0) + 1);
  for (const index of state.batchNumbers) {
    const problem = problems.find(item => item.index === index);
    if (!problem) { issues.push(`problem_${index}_missing`); continue; }
    if (counts.get(index) !== 1) { issues.push(`problem_${index}_duplicate`); continue; }
    const validation = validatePracticeProblem(problem, practiceOutputMode(state.input), true);
    if (!validation.valid) { issues.push(...validation.issues.map(issue => `problem_${index}_${issue}`)); continue; }
    completed[index] = canonicalPracticeProblem(problem, `${state.setId}:problem:${index}`, index);
  }
  if (problems.some(problem => !state.batchNumbers.includes(problem.index))) issues.push("unexpected_problem_number");
  const ready = savedContent(completed);
  // Preserve an interrupted draft, but only validated blocks count toward recovery.
  const draft = problems.filter(problem => !completed[problem.index]).map(problem => problem.rawContent).join("\n\n") || (!problems.length ? state.candidate : "");
  const content = issues.length || state.terminal?.type !== "complete"
    ? [ready, draft].filter(Boolean).join("\n\n") : ready;
  publishProgress({ ...state, completed }, content);
  const halt = state.terminal?.type === "complete" ? undefined : state.terminal?.type === "cancelled" ? "user_cancelled" : state.terminal && "reason" in state.terminal ? state.terminal.reason : "unexpected_eof";
  return { completed, content, issues, halt };
}

function afterValidation(state: TaskState): "generate" | "repair" | "finish" {
  if (state.halt || !state.practice) return "finish";
  if (!remaining(state).length && !state.issues.length) return "finish";
  if (budgetReason(state)) return "finish";
  if (state.issues.length) return state.repairs < taskBudget.maxRepairs ? "repair" : "finish";
  return "generate";
}

function finishTask(state: TaskState) {
  const incomplete = state.practice && (remaining(state).length || state.issues.length);
  const halt = Date.now() - state.runtime.startedAt >= state.runtime.maxDurationMs ? "task_timeout" : state.runtime.signal.aborted ? "user_cancelled" : state.halt ?? (incomplete ? budgetReason(state) ?? "practice_contract_incomplete" : undefined);
  if (halt) {
    state.runtime.emit(halt === "user_cancelled" ? { type: "cancelled", reason: halt } : { type: state.terminal?.type === "truncated" || halt === "task_output_budget" ? "truncated" : "interrupted", reason: halt, retryable: state.terminal && "retryable" in state.terminal ? state.terminal.retryable : true, usage: state.usage });
    return {};
  }
  let content = state.content;
  if (!state.practice) {
    const finalized = appendResponseSuffix(content, state.input.intent ?? "general_question", state.input.detectedLanguage ?? "en");
    if (finalized !== content) state.runtime.emit({ type: "delta", seq: 1, text: finalized.slice(content.length) });
    content = finalized;
  }
  state.runtime.emit({ type: "stage", stage: "commit" });
  state.runtime.emit({ type: "memory", memory: commitLearningMemory(state.input, content) });
  state.runtime.emit({ type: "complete", finishReason: "task_complete", usage: state.usage });
  return { content };
}

function taskFailure(error: unknown): GenerationPayload {
  if (error instanceof DeepSeekError) {
    const reason = error.status === 401 || error.status === 403 ? "provider_authentication" : error.status === 429 ? "provider_rate_limit" : error.code;
    const retryable = !["missing-key", "invalid-provider", "provider_authentication"].includes(reason) && (error.status >= 429 || error.code === "network-error" || error.code === "timeout" || error.code === "empty-response");
    return { type: "interrupted", reason, retryable };
  }
  return { type: "interrupted", reason: "task_failed", retryable: true };
}

const taskGraph = new StateGraph(State)
  .addNode("plan", planTask)
  .addNode("generate", state => generate(state))
  .addNode("validate", validateOutput)
  .addNode("repair", state => generate(state, true))
  .addNode("finish", finishTask)
  .addEdge(START, "plan")
  .addEdge("plan", "generate")
  .addEdge("generate", "validate")
  .addConditionalEdges("validate", afterValidation, { generate: "generate", repair: "repair", finish: "finish" })
  .addEdge("repair", "validate")
  .addEdge("finish", END)
  .compile();

export function streamAgentTask(prepared: PreparedAgentRequest, parentSignal: AbortSignal, options: { binding: GenerationBinding; initialEvents?: GenerationPayload[]; budget?: Partial<Pick<TaskRuntime, "maxDurationMs" | "maxOutputTokens">>; onSettled?: (usage?: TokenUsage) => void }) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener("abort", abort, { once: true });
  if (parentSignal.aborted) abort();
  let cancelled = false;
  let timedOut = false;
  let seq = 0;
  let usage: TokenUsage | undefined;
  let settled = false;
  const settle = () => { if (!settled) { settled = true; options.onSettled?.(usage); } };
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const maxDurationMs = options.budget?.maxDurationMs ?? taskBudget.maxDurationMs;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, maxDurationMs);
  return new ReadableStream<Uint8Array>({
    async start(output) {
      const emit = (payload: GenerationPayload) => {
        if (cancelled) return;
        if (timedOut && payload.type === "cancelled") payload = { type: "interrupted", reason: "task_timeout", retryable: true };
        if (payload.type === "complete" || payload.type === "interrupted" || payload.type === "truncated") usage = payload.usage;
        const event = payload.type === "delta" ? { ...payload, seq: ++seq } : payload;
        output.enqueue(encoder.encode(encodeGenerationEvent({ ...options.binding, ...event })));
      };
      try {
        for (const event of options.initialEvents ?? []) emit(event);
        await taskGraph.invoke({ input: prepared.input, runtime: { emit, signal: controller.signal, startedAt, maxDurationMs, maxOutputTokens: options.budget?.maxOutputTokens ?? taskBudget.maxOutputTokens } }, { recursionLimit: 70 });
      } catch (error) {
        emit(controller.signal.aborted ? { type: "cancelled", reason: "user_cancelled" } : taskFailure(error));
      } finally {
        parentSignal.removeEventListener("abort", abort);
        clearTimeout(timer);
        settle();
        if (!cancelled) output.close();
      }
    },
    cancel() { cancelled = true; clearTimeout(timer); controller.abort(); settle(); },
  });
}
