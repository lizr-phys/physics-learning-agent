import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const provider = vi.hoisted(() => ({ ask: vi.fn() }));

vi.mock("@/lib/deepseek", () => ({
  askDeepSeek: provider.ask,
  DeepSeekError: class extends Error {},
  getDeepSeekPublicConfig: () => ({
    configured: true,
    baseUrl: "https://example.test",
    model: "deepseek-flash",
    timeoutMs: 1000,
  }),
}));

describe("connection diagnostics", () => {
  beforeEach(() => { provider.ask.mockResolvedValue("connection ok"); });
  afterEach(() => { provider.ask.mockReset(); });

  it("checks status without calling a model", async () => {
    const response = await GET(new NextRequest("http://localhost/api/deepseek/test?mode=status"));
    expect(await response.json()).toMatchObject({ status: "configured", config: { model: "deepseek-flash" } });
    expect(provider.ask).not.toHaveBeenCalled();
  });

  it("uses the chosen server model and binds cancellation", async () => {
    const request = new NextRequest("http://localhost/api/deepseek/test?model=deepseek-v4-pro");
    const response = await GET(request);
    expect(await response.json()).toMatchObject({ ok: true, config: { model: "deepseek-v4-pro" } });
    expect(provider.ask).toHaveBeenCalledWith(expect.objectContaining({ model: "deepseek-v4-pro" }), request.signal);
  });

  it("rejects an unsupported selection before reaching the provider", async () => {
    const response = await GET(new NextRequest("http://localhost/api/deepseek/test?model=unknown-model"));
    expect(response.status).toBe(400);
    expect(provider.ask).not.toHaveBeenCalled();
  });

  it("requires a key in a personal-provider test and never falls back to the default", async () => {
    const request = new NextRequest("http://localhost/api/deepseek/test", {
      method: "POST",
      body: JSON.stringify({ clientProvider: { provider: "anthropic", type: "anthropic", model: "chosen-model", apiKey: "" } }),
    });
    expect((await POST(request)).status).toBe(400);
    expect(provider.ask).not.toHaveBeenCalled();
  });
});
