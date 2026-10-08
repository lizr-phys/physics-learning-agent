import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ user: null as null | { id: string }, references: [] as unknown[] }));
vi.mock("@/lib/auth-server", () => ({ getUserFromRequest: async () => state.user }));
vi.mock("@/lib/user-data-server", () => ({ readUserData: async () => ({ sessions: state.references, practiceHistory: [] }) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: () => ({ allowed: true }), getRequestClientKey: () => "synthetic" }));
import { GET as list, POST as upload } from "@/app/api/images/route";
import { GET as read, DELETE as remove } from "@/app/api/images/[id]/route";
import { POST as importImages } from "@/app/api/images/import/route";
import type { ImageAttachment } from "@/types/learning";

let directory: string;
const token = "a".repeat(64);
const headers = () => ({ "X-PLA-Workspace-Owner": state.user?.id ?? "guest", "X-PLA-Guest-Media-Token": token });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (url: string, method = "GET", body?: BodyInit) => new NextRequest(`http://localhost${url}`, { method, headers: headers(), body });
async function savedImage() {
  const data = await sharp({ create: { width: 40, height: 30, channels: 3, background: "white" } }).png().toBuffer();
  const response = await upload(request("/api/images", "POST", new Uint8Array(data)));
  expect(response.status).toBe(200);
  return { response, image: (await response.json()).image as ImageAttachment };
}
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "pla-image-routes-"));
  vi.stubEnv("PLA_DATA_DIR", directory); state.user = null; state.references = [];
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("private image routes", () => {
  it("sets a private guest cookie and serves only safe normalized bytes", async () => {
    const { response, image } = await savedImage();
    expect(response.headers.get("set-cookie")).toMatch(/pla_guest_images=.*HttpOnly/i);
    const displayed = await read(request(`/api/images/${image.id}`), context(image.id));
    expect(displayed.headers.get("cache-control")).toBe("private, no-store");
    expect(displayed.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await sharp(Buffer.from(await displayed.arrayBuffer())).metadata()).format).toBe("webp");
    const outsider = new NextRequest(`http://localhost/api/images/${image.id}`, { headers: { "X-PLA-Guest-Media-Token": "b".repeat(64) } });
    expect((await read(outsider, context(image.id))).status).toBe(404);
  });
  it("never grants an authenticated account access through a guest credential", async () => {
    const { image } = await savedImage();
    state.user = { id: "synthetic-account-a" };
    expect((await read(request(`/api/images/${image.id}`), context(image.id))).status).toBe(404);
    expect((await list(request("/api/images"))).status).toBe(200);
    expect(await (await list(request("/api/images"))).json()).toEqual({ images: [] });
  });
  it("refuses stale owner headers before saving or importing", async () => {
    state.user = { id: "synthetic-account-b" };
    const stale = new NextRequest("http://localhost/api/images", { method: "POST", headers: { "X-PLA-Workspace-Owner": "synthetic-account-a" }, body: "synthetic" });
    expect((await upload(stale)).status).toBe(409);
    const imported = new NextRequest("http://localhost/api/images/import", { method: "POST", headers: { "X-PLA-Workspace-Owner": "synthetic-account-a" }, body: '{"ids":[]}' });
    expect((await importImages(imported)).status).toBe(409);
  });
  it("copies anonymous images only through explicit import and retains original bytes", async () => {
    const { image } = await savedImage();
    const original = await (await read(request(`/api/images/${image.id}`), context(image.id))).arrayBuffer();
    state.user = { id: "synthetic-account-a" };
    const imported = await importImages(request("/api/images/import", "POST", JSON.stringify({ ids: [image.id] })));
    expect(imported.status).toBe(200);
    const copy: ImageAttachment = (await imported.json()).images[image.id];
    expect(copy.id).not.toBe(image.id);
    expect(await (await read(request(`/api/images/${copy.id}`), context(copy.id))).arrayBuffer()).toEqual(original);
    state.user = { id: "synthetic-account-b" };
    expect((await read(request(`/api/images/${copy.id}`), context(copy.id))).status).toBe(404);
    state.user = null;
    expect((await read(request(`/api/images/${image.id}`), context(image.id))).status).toBe(200);
  });
  it("rolls back a partial import when any source image is unavailable", async () => {
    const { image } = await savedImage();
    state.user = { id: "synthetic-account-a" };
    const imported = await importImages(request("/api/images/import", "POST", JSON.stringify({ ids: [image.id, "image-00000000-0000-4000-8000-000000000001"] })));
    expect(imported.status).toBe(404);
    expect(await (await list(request("/api/images"))).json()).toEqual({ images: [] });
    state.user = null;
    expect((await read(request(`/api/images/${image.id}`), context(image.id))).status).toBe(200);
  });
  it("keeps referenced account images and deletes only unused owned uploads", async () => {
    state.user = { id: "synthetic-account-a" }; const { image } = await savedImage();
    state.references = [{ messages: [{ images: [image] }] }];
    expect((await remove(request(`/api/images/${image.id}`, "DELETE"), context(image.id))).status).toBe(409);
    state.references = [];
    expect((await remove(request(`/api/images/${image.id}`, "DELETE"), context(image.id))).status).toBe(200);
    expect((await read(request(`/api/images/${image.id}`), context(image.id))).status).toBe(404);
  });
  it("rejects mislabeled SVG, oversized input and malformed import JSON", async () => {
    expect((await upload(request("/api/images", "POST", "<svg><script/></svg>"))).status).toBe(400);
    const oversized = new NextRequest("http://localhost/api/images", { method: "POST", headers: { ...headers(), "content-length": "10485761" }, body: "small" });
    expect((await upload(oversized)).status).toBe(413);
    state.user = { id: "synthetic-account-a" };
    expect((await importImages(request("/api/images/import", "POST", "{broken"))).status).toBe(400);
  });
});
