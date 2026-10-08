import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { storeImage } from "@/lib/image-store";
import type { AgentRequest } from "@/types/learning";
vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ input: undefined as AgentRequest | undefined, calls: 0, userId: "test-stream-account" }));
vi.mock("@/lib/auth-server", () => ({ getUserFromRequest: async () => ({ id: state.userId }) }));
vi.mock("@/agent/workflow", () => ({
  prepareAgentRequest: async (input: AgentRequest) => { state.input = input; return { input, stages: ["prepare-generation"] }; },
  finalizePreparedAgentMemory: () => ({ recentConfusions: [], coveredConcepts: [], exerciseTopics: [], preferredStyle: "balanced", updatedAt: 1 }),
}));
vi.mock("@/lib/deepseek", () => ({
  DeepSeekError: class extends Error {},
  openProviderEventStream: async () => {
    state.calls++;
    return (async function* () {
      yield { type: "delta" as const, text: "Answer" };
      yield { type: "complete" as const, finishReason: "stop", usage: { outputTokens: 1 } };
    })();
  },
}));
import { POST } from "@/app/api/chat/route";

beforeEach(() => { state.input = undefined; state.calls = 0; });
const request = (owner: string, body: object) => new NextRequest("http://localhost/api/chat", {
  method: "POST", headers: { "Content-Type": "application/json", "X-PLA-Workspace-Owner": owner }, body: JSON.stringify(body),
});
const body = { message: "Explain boundary conditions", conversationId: "session", assistantMessageId: "assistant", requestId: "request", authEpoch: "epoch" };

describe("chat stream route", () => {
  it("rejects stale-account requests before contacting a provider", async () => {
    const response = await POST(request("old-account", body));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "WORKSPACE_OWNER_CHANGED" });
    expect(state.calls).toBe(0);
  });
  it("binds every typed event to authenticated account and generation IDs", async () => {
    const response = await POST(request(state.userId, body));
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const raw = await response.text();
    const events = raw.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
    expect(events.length).toBeGreaterThan(4);
    for (const event of events) expect(event).toMatchObject({ ownerId: state.userId, authEpoch: "epoch", sessionId: "session", messageId: "assistant", requestId: "request" });
    expect(events.map(event => event.type)).toContain("memory");
  });
  it("preserves complete history, IDs, interruption status and follow-up count for the allocator", async () => {
    const content = "Boundary assumptions. ".repeat(180) + "$$\n\\psi(0)=0 \\tag{1}\n$$";
    await POST(request(state.userId, { ...body, exerciseCount: 2, history: [{ id: "old-answer", role: "assistant", content, status: "interrupted" }] }));
    expect(state.input?.exerciseCount).toBe(2);
    expect(state.input?.history?.[0]).toEqual({ id: "old-answer", role: "assistant", content, status: "interrupted", createdAt: undefined });
  });
  it("resolves owned image-only history and keeps bytes outside SSE and public recovery parameters", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pla-image-chat-"));
    vi.stubEnv("PLA_DATA_DIR", directory);
    try {
      const image = await storeImage(`account:${state.userId}`, await sharp({ create: { width: 40, height: 30, channels: 3, background: "white" } }).png().toBuffer(), "synthetic.png");
      const response = await POST(request(state.userId, { ...body, model: "deepseek-flash", history: [{ role: "user", content: "", images: [image] }], resolvedImages: { [image.id]: { mimeType: "image/webp", data: "CLIENT_FORGED_BYTES" } } }));
      expect(response.status).toBe(200);
      const raw = await response.text();
      expect(state.input?.model).toBe("deepseek-flash");
      expect(state.input?.history?.[0].images?.[0].id).toBe(image.id);
      expect(state.input?.resolvedImages?.[image.id].data).toBeTruthy();
      expect(state.input?.resolvedImages?.[image.id].data).not.toBe("CLIENT_FORGED_BYTES");
      expect(raw).not.toContain(state.input?.resolvedImages?.[image.id].data);
      expect(raw).not.toContain("CLIENT_FORGED_BYTES");
    } finally { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); }
  });
  it("refuses image references from another account before generation", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pla-image-cross-account-"));
    vi.stubEnv("PLA_DATA_DIR", directory);
    try {
      const image = await storeImage("account:other-synthetic-account", await sharp({ create: { width: 40, height: 30, channels: 3, background: "white" } }).png().toBuffer(), "private.png");
      const response = await POST(request(state.userId, { ...body, images: [image] }));
      expect(response.status).toBe(404); expect(state.calls).toBe(0);
    } finally { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); }
  });
});
