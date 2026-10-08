import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePracticeProblems } from "@/lib/practice-parser";
import type { GenerationEvent } from "@/lib/generation-stream";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ userId: "", calls: [] as Array<Record<string, unknown>>, interruptCall: 0, invalidCalls: 0, omitUsage: false }));
vi.mock("@/lib/auth-server", () => ({ getUserFromRequest: async () => ({ id: state.userId }) }));
import { POST } from "@/app/api/chat/route";

const problem = (index: number, missingAnswer = false) => `### Problem ${index}\n**Training goal**: Apply given parameters.\n**Conditions**: A real positive parameter a has value ${index}.\n**Problem**: Determine the original expression $2a+1$ for this parameter.\n**Topics**: Algebraic substitution\n**Difficulty**: Basic\n**Hint**: Insert the supplied value of a.\n**Solution**: Double the supplied parameter and then add one.\n**Answer**: ${missingAnswer ? "" : `$${2 * index + 1}$`}`;
const request = (body: Record<string, unknown>, signal?: AbortSignal) => new NextRequest("http://localhost/api/chat", {
  method: "POST", signal, headers: { "Content-Type": "application/json", "X-PLA-Workspace-Owner": state.userId },
  body: JSON.stringify({ message: "Generate 10 original quantum mechanics practice problems.", course: "quantum-mechanics", module: "practice", taskType: "practice", intent: "exercise_generation", exerciseCount: 10, practiceOutputMode: "hidden-answer", knowledgeMode: "never", conversationId: "set", assistantMessageId: "answer", requestId: crypto.randomUUID(), authEpoch: "test-epoch", practiceTask: { setId: "set" }, ...body }),
});
async function events(response: Response) {
  return (await response.text()).split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)) as GenerationEvent);
}
const snapshot = (data: GenerationEvent[]) => data.filter((event): event is Extract<GenerationEvent, { type: "practice" }> => event.type === "practice").at(-1)!;

beforeEach(() => {
  state.userId = `synthetic-task-${crypto.randomUUID()}`;
  state.calls = []; state.interruptCall = 0; state.invalidCalls = 0; state.omitUsage = false;
  vi.stubEnv("DEEPSEEK_API_KEY", "synthetic-provider-key");
  vi.stubEnv("PLA_GENERATION_ENABLED", "true");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    state.calls.push(payload);
    const messages = payload.messages as Array<{ content: string }>;
    const prompt = messages.at(-1)?.content ?? "";
    const numbers = prompt.match(/numbered ([0-9, ]+)\./)?.[1].split(",").map(Number) ?? [];
    const invalid = state.calls.length <= state.invalidCalls;
    const text = state.interruptCall === state.calls.length ? `### Problem ${numbers[0]}\n**Problem**: This incomplete draft still needs conditions and a solution.` : numbers.length ? numbers.map(index => problem(index, invalid)).join("\n\n") : "A concise general answer.";
    const delta = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
    const done = `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: state.omitUsage ? undefined : { prompt_tokens: 40, completion_tokens: 100 } })}\n\ndata: [DONE]\n\n`;
    return new Response(delta + (state.interruptCall === state.calls.length ? "" : done), { headers: { "Content-Type": "text/event-stream" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("real API and LangGraph with a mock upstream provider", () => {
  it("generates ten complete problems in five actual two-problem provider calls", async () => {
    const data = await events(await POST(request({})));
    expect(state.calls).toHaveLength(5);
    expect(snapshot(data).task.completedProblemIds).toHaveLength(10);
    expect(parsePracticeProblems(snapshot(data).content)).toHaveLength(10);
    expect(data.at(-1)?.type).toBe("complete");
    expect(data.filter(event => event.type === "memory")).toHaveLength(1);
    for (const payload of state.calls) {
      const prompt = (payload.messages as Array<{ content: string }>).at(-1)!.content;
      expect(prompt).toContain("Practice count: 2");
      expect(Number(payload.max_tokens)).toBeLessThanOrEqual(4800);
      expect(prompt).toContain("Do not invent a textbook source");
    }
    const sequences = data.filter((event): event is Extract<GenerationEvent, { type: "delta" }> => event.type === "delta").map(event => event.seq);
    expect(sequences).toEqual(sequences.map((_, index) => index + 1));
  });
  it("preserves completed IDs after unexpected EOF and resumes the remaining eight", async () => {
    state.interruptCall = 2;
    const first = await events(await POST(request({})));
    expect(first.at(-1)?.type).toBe("interrupted");
    expect(first.some(event => event.type === "memory")).toBe(false);
    const retained = snapshot(first);
    expect(retained.task.completedProblemIds).toHaveLength(2);
    const completedBefore = retained.task.completedProblemIds;
    state.interruptCall = 0;
    const second = await events(await POST(request({ practiceTask: { setId: "set", resumeContent: retained.content } })));
    expect(second.at(-1)?.type).toBe("complete");
    expect(snapshot(second).task.completedProblemIds).toEqual(expect.arrayContaining(completedBefore));
    expect(snapshot(second).task.completedProblemIds).toHaveLength(10);
    expect(new Set(parsePracticeProblems(snapshot(second).content).map(problem => problem.id)).size).toBe(10);
  });
  it("uses at most one repair and reports persistent missing fields as partial", async () => {
    state.invalidCalls = 10;
    const data = await events(await POST(request({ exerciseCount: 3, message: "Generate 3 original quantum mechanics problems." })));
    expect(state.calls).toHaveLength(2);
    expect(data.filter(event => event.type === "stage" && event.stage === "repair")).toHaveLength(1);
    expect(data.at(-1)?.type).toBe("interrupted");
    expect(data.some(event => event.type === "memory")).toBe(false);
  });
  it("routes ordinary questions through one provider call and one final memory commit", async () => {
    const data = await events(await POST(request({ module: "chat", taskType: "qa", intent: "general_question", message: "Write a brief email.", practiceTask: undefined })));
    expect(state.calls).toHaveLength(1);
    expect(data.some(event => event.type === "practice")).toBe(false);
    expect(data.at(-1)?.type).toBe("complete");
    expect(data.filter(event => event.type === "memory")).toHaveLength(1);
  });
  it("releases admission on client cancellation and does not commit partial memory", async () => {
    const controller = new AbortController();
    controller.abort();
    const response = await POST(request({}, controller.signal));
    const data = response.headers.get("content-type")?.includes("event-stream") ? await events(response) : [];
    expect(data.some(event => event.type === "memory")).toBe(false);
    expect(state.calls).toHaveLength(0);
  });
  it("retains the daily reservation when a provider omits token usage", async () => {
    vi.stubEnv("PLA_GENERATION_DAILY_OUTPUT_TOKENS_PER_USER", "24000");
    state.omitUsage = true;
    const first = await events(await POST(request({ exerciseCount: 3, message: "Generate 3 original quantum mechanics problems." })));
    const final = first.at(-1);
    expect(final?.type).toBe("complete");
    expect(final && "usage" in final ? final.usage?.outputTokens : undefined).toBeUndefined();
    const second = await POST(request({ exerciseCount: 3 }));
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({ code: "GENERATION_USER_DAILY_LIMIT" });
  });
  it("reports credential rejection without leaking the upstream error payload or committing memory", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "private-payload synthetic-provider-key" } }), { status: 401, headers: { "Content-Type": "application/json" } })));
    const data = await events(await POST(request({})));
    expect(data.at(-1)).toMatchObject({ type: "interrupted", reason: "provider_authentication", retryable: false });
    expect(data.some(event => event.type === "memory" || event.type === "complete")).toBe(false);
    expect(JSON.stringify(data)).not.toContain("private-payload");
    expect(JSON.stringify(data)).not.toContain("synthetic-provider-key");
  });
});
