import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateContextTokens } from "@/agent/context-manager";
import { hasUnclosedPracticeMarkup } from "@/lib/practice-parser";
import type { GenerationEvent } from "@/lib/generation-stream";
vi.mock("server-only", () => ({}));
import { prepareAgentRequest } from "@/agent/workflow";
import { streamAgentTask } from "@/agent/task-workflow";

const binding = { ownerId: "synthetic-budget", authEpoch: "test", sessionId: "s", messageId: "m", requestId: "r" };
const parse = (raw: string): GenerationEvent[] => raw.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
const encoded = (text: string) => new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
beforeEach(() => vi.stubEnv("DEEPSEEK_API_KEY", "synthetic-key"));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("bounded task execution", () => {
  it("caps Chinese output by tokens rather than treating four Chinese characters as one token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(encoded("中".repeat(100)))));
    const prepared = await prepareAgentRequest({ message: "说明牛顿第二定律", intent: "physics_learning", knowledgeMode: "never" });
    const data = parse(await new Response(streamAgentTask(prepared, new AbortController().signal, { binding, budget: { maxOutputTokens: 40 } })).text());
    const text = data.filter((event): event is Extract<GenerationEvent, { type: "delta" }> => event.type === "delta").map(event => event.text).join("");
    expect(estimateContextTokens(text)).toBeLessThanOrEqual(40);
    expect(text).toHaveLength(40);
    expect(data.at(-1)).toMatchObject({ type: "truncated", reason: "task_output_budget" });
    expect(data.some(event => event.type === "memory")).toBe(false);
  });
  it("enforces an absolute task deadline and settles the lease once", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(output) { output.enqueue(encoded("Partial text")); } }))));
    const prepared = await prepareAgentRequest({ message: "Explain a boundary condition.", intent: "physics_learning", knowledgeMode: "never" });
    const settled = vi.fn();
    const result = new Response(streamAgentTask(prepared, new AbortController().signal, { binding, budget: { maxDurationMs: 30 }, onSettled: settled })).text();
    await vi.advanceTimersByTimeAsync(31);
    const data = parse(await result);
    expect(data.at(-1)).toMatchObject({ type: "interrupted", reason: "task_timeout" });
    expect(data.some(event => event.type === "memory")).toBe(false);
    expect(settled).toHaveBeenCalledTimes(1);
  });
  it("preserves complete formula blocks in a long bounded repair prompt", async () => {
    const calls: string[] = [];
    const formula = `$$\n${"x+".repeat(3500)}0\n$$`;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body));
      const prompt = payload.messages.at(-1).content as string;
      calls.push(prompt);
      const numbers = prompt.match(/numbered ([0-9, ]+)\./)?.[1].split(",").map(Number) ?? [];
      const blocks = numbers.map(index => `### Problem ${index}\n**Training goal**: Apply parameters.\n**Conditions**: Let a be a given positive parameter.\n**Problem**: Determine the original expression $2a$.\n**Topics**: Substitution\n**Difficulty**: Basic\n**Hint**: Substitute a.\n**Solution**: ${calls.length === 1 && index === 1 ? formula : "Double a."}\n**Answer**: ${calls.length === 1 ? "" : "$2a$"}`).join("\n\n");
      return new Response(new TextDecoder().decode(encoded(blocks)) + `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { completion_tokens: 100 } })}\n\n`);
    }));
    const prepared = await prepareAgentRequest({ message: "Generate 3 original quantum mechanics practice problems.", course: "quantum-mechanics", module: "practice", taskType: "practice", exerciseCount: 3, practiceOutputMode: "hidden-answer", knowledgeMode: "never" });
    const data = parse(await new Response(streamAgentTask(prepared, new AbortController().signal, { binding })).text());
    expect(calls).toHaveLength(3);
    expect(calls[1]).toContain(formula);
    expect(hasUnclosedPracticeMarkup(calls[1])).toBe(false);
    expect(data.at(-1)?.type).toBe("complete");
  });
});
