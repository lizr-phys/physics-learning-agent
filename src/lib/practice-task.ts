import { parsePracticeProblems, validatePracticeProblem } from "@/lib/practice-parser";
import type { AgentRequest, PracticeOutputMode } from "@/types/learning";

export type PracticeTaskProgress = {
  version: 1;
  setId: string;
  targetCount: number;
  outputMode: PracticeOutputMode;
  completedProblemIds: string[];
};
export type PracticeRequestParameters = Pick<AgentRequest,
  "message" | "module" | "taskType" | "course" | "knowledgePoint" | "difficulty" |
  "exerciseCount" | "includeAnswer" | "includeSolution" | "includeHint" | "practiceOutputMode" |
  "practiceStyle" | "detectedLanguage" | "answerDepth" | "referenceProfile" | "knowledgeMode" |
  "knowledgeDocumentIds" | "knowledgeCourseOnly" | "images" | "model"
>;

export function safePracticeRequest(request: AgentRequest): PracticeRequestParameters {
  const { message, module, taskType, course, knowledgePoint, difficulty, exerciseCount, includeAnswer, includeSolution, includeHint, practiceOutputMode, practiceStyle, detectedLanguage, answerDepth, referenceProfile, knowledgeMode, knowledgeDocumentIds, knowledgeCourseOnly } = request;
  return { message, module, taskType, course, knowledgePoint, difficulty, exerciseCount, includeAnswer, includeSolution, includeHint, practiceOutputMode, practiceStyle, detectedLanguage, answerDepth, referenceProfile, knowledgeMode, knowledgeDocumentIds, knowledgeCourseOnly, images:request.images, model:request.model };
}

export function practiceOutputMode(request: AgentRequest): PracticeOutputMode {
  return request.practiceOutputMode ?? (request.includeSolution || request.includeAnswer ? "full-solution" : request.includeHint ? "questions-hints" : "questions-only");
}

export function practiceProgress(request: AgentRequest, content: string, setId: string, strict = false): PracticeTaskProgress {
  const outputMode = practiceOutputMode(request);
  const targetCount = Math.max(1, Math.min(20, Math.round(request.exerciseCount ?? 5)));
  const completedProblemIds = parsePracticeProblems(content, { setId })
    .filter((problem) => problem.index >= 1 && problem.index <= targetCount && validatePracticeProblem(problem, outputMode, strict).valid)
    .map((problem) => problem.id);
  return { version: 1, setId, targetCount, outputMode, completedProblemIds: [...new Set(completedProblemIds)] };
}

export function normalizePracticeProgress(value: unknown): PracticeTaskProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const task = value as Record<string, unknown>;
  if (task.version !== 1 || typeof task.setId !== "string" || !/^[A-Za-z0-9:._-]{1,120}$/.test(task.setId)) return undefined;
  if (!Number.isSafeInteger(task.targetCount) || Number(task.targetCount) < 1 || Number(task.targetCount) > 20) return undefined;
  if (!["questions-only", "questions-hints", "full-solution", "hidden-answer"].includes(String(task.outputMode))) return undefined;
  const completedProblemIds = Array.isArray(task.completedProblemIds)
    ? task.completedProblemIds.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9:._-]{1,180}$/.test(id)).slice(0, 20) : [];
  return { version: 1, setId: task.setId, targetCount: Number(task.targetCount), outputMode: task.outputMode as PracticeOutputMode, completedProblemIds: [...new Set(completedProblemIds)] };
}
