import type { AgentRequest, LearningMemory, RagContext, TokenUsage } from "@/types/learning";
export type { TokenUsage } from "@/types/learning";

export type GenerationBinding = {
  ownerId: string;
  authEpoch: string;
  sessionId: string;
  messageId: string;
  requestId: string;
};
export type GenerationEvent = GenerationBinding & (
  | { type: "delta"; seq: number; text: string }
  | { type: "activity" }
  | { type: "stage"; stage: string }
  | { type: "sources"; sources: RagContext["snippets"]; status?: string }
  | { type: "context"; context: Partial<AgentRequest> }
  | { type: "memory"; memory: LearningMemory }
  | { type: "practice"; task: import("@/lib/practice-task").PracticeTaskProgress; content: string }
  | { type: "complete"; finishReason: string; usage?: TokenUsage }
  | { type: "truncated"; reason: string; retryable: boolean; usage?: TokenUsage }
  | { type: "interrupted"; reason: string; retryable: boolean; usage?: TokenUsage }
  | { type: "cancelled"; reason: string }
);

export type GenerationPayload = GenerationEvent extends infer Event
  ? Event extends GenerationEvent ? Omit<Event, keyof GenerationBinding> : never
  : never;

export function encodeGenerationEvent(event: GenerationEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function isGenerationEvent(value: unknown): value is GenerationEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  if (!["ownerId", "authEpoch", "sessionId", "messageId", "requestId"].every((key) => typeof event[key] === "string" && Boolean(event[key]))) return false;
  switch (event.type) {
    case "delta": return typeof event.text === "string" && Number.isSafeInteger(event.seq) && Number(event.seq) > 0;
    case "activity": return true;
    case "stage": return typeof event.stage === "string";
    case "sources": return Array.isArray(event.sources);
    case "context": return Boolean(event.context) && typeof event.context === "object";
    case "memory": return Boolean(event.memory) && typeof event.memory === "object";
    case "practice": return Boolean(event.task) && typeof event.task === "object" && typeof event.content === "string";
    case "complete": return typeof event.finishReason === "string";
    case "truncated":
    case "interrupted": return typeof event.reason === "string" && typeof event.retryable === "boolean";
    case "cancelled": return typeof event.reason === "string";
    default: return false;
  }
}

export function matchesGenerationBinding(event: GenerationBinding, expected: GenerationBinding) {
  return (["ownerId", "authEpoch", "sessionId", "messageId", "requestId"] as const)
    .every((key) => event[key] === expected[key]);
}
