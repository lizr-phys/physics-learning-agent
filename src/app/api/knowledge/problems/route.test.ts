import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ user: { id: "synthetic-photo-account" } as { id: string } | null }));
vi.mock("@/lib/auth-server", () => ({ getUserFromRequest: async () => state.user }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: () => ({ allowed: true }) }));
import { POST } from "@/app/api/knowledge/problems/route";
import { GET as read } from "@/app/api/knowledge/documents/[id]/route";
import { DELETE as removeImage } from "@/app/api/images/[id]/route";
import { storeImage } from "@/lib/image-store";
import { deletePersonalDocument, listPersonalDocuments, reindexPersonalDocument, retrievePersonalKnowledge } from "@/lib/personal-knowledge";
import { buildPhotoProblemPrompt } from "@/lib/photo-problem";
import type { ImageAttachment } from "@/types/learning";

let directory: string, image: ImageAttachment;
const content = "# Capacitor energy homework\n\n## Question\nFind the stored energy of a capacitor.\n\n## Given conditions\nCapacitance C = 2 microfarads and voltage V = 5 volts.\n\n## Topics\nCapacitor stored energy.\n\n## Unclear details\nNone.";
const data = () => ({ title: "Capacitor exam", kind: "exam", content, images: [image], course: "general-physics", reviewed: true, sourceNote: "My own photographed assignment" });
const request = (body: unknown) => new NextRequest("http://localhost/api/knowledge/problems", { method: "POST", headers: { "Content-Type": "application/json", "X-PLA-Workspace-Owner": state.user?.id ?? "guest" }, body: JSON.stringify(body) });
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "pla-photo-notes-")); vi.stubEnv("PLA_DATA_DIR", directory);
  state.user = { id: "synthetic-photo-account" };
  image = await storeImage(`account:${state.user.id}`, await sharp({ create: { width: 40, height: 30, channels: 3, background: "white" } }).png().toBuffer(), "synthetic-exam.png");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("reviewed photo problem library", () => {
  it("requires a signed-in account, source image and explicit text review", async () => {
    expect((await POST(request({ ...data(), reviewed: false }))).status).toBe(400);
    expect((await POST(request({ ...data(), images: [] }))).status).toBe(400);
    expect(await listPersonalDocuments(state.user!.id)).toEqual([]);
    state.user = null;
    expect((await POST(request(data()))).status).toBe(401);
  });
  it("indexes confirmed text and retains owned images and user provenance", async () => {
    const response = await POST(request(data())); expect(response.status).toBe(201);
    const { document } = await response.json();
    expect(document).toMatchObject({ indexStatus: "indexed", course: "general-physics", problem: { kind: "exam", images: [{ id: image.id }], sourceNote: "My own photographed assignment" } });
    const opened = await read(new NextRequest("http://localhost"), { params: Promise.resolve({ id: document.id }) });
    expect(opened.headers.get("cache-control")).toBe("private, no-store");
    expect((await opened.json()).content).toBe(content);
    const found = await retrievePersonalKnowledge(state.user!.id, "capacitor stored energy", { documentIds: [document.id] });
    expect(found.length).toBeGreaterThan(0); expect(found[0].content).toContain("2 microfarads");
    expect((await reindexPersonalDocument(state.user!.id, document.id))?.problem?.images[0].id).toBe(image.id);
  });
  it("deduplicates concurrent identical save retries", async () => {
    const [a, b] = await Promise.all([POST(request(data())), POST(request(data()))]);
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect((await a.json()).document.id).toBe((await b.json()).document.id);
    expect(await listPersonalDocuments(state.user!.id)).toHaveLength(1);
  });
  it("denies another account's photos, notebook text and retrieval", async () => {
    const { document } = await (await POST(request(data()))).json();
    state.user = { id: "another-synthetic-account" };
    expect((await POST(request(data()))).status).toBe(404);
    expect((await read(new NextRequest("http://localhost"), { params: Promise.resolve({ id: document.id }) })).status).toBe(404);
    expect(await retrievePersonalKnowledge(state.user.id, "capacitor stored energy", { documentIds: [document.id] })).toEqual([]);
  });
  it("protects notebook source images until their record is explicitly removed", async () => {
    const { document } = await (await POST(request(data()))).json();
    const imageRequest = () => new NextRequest("http://localhost/api/images", { method: "DELETE" });
    const context = { params: Promise.resolve({ id: image.id }) };
    expect((await removeImage(imageRequest(), context)).status).toBe(409);
    await deletePersonalDocument(state.user!.id, document.id);
    expect((await removeImage(imageRequest(), context)).status).toBe(200);
  });
  it("asks for faithful transcription, uncertainty and no invented solution", () => {
    const prompt = buildPhotoProblemPrompt({ kind: "homework", sourceNote: "Physics assignment", topic: "capacitors" });
    expect(prompt).toContain("without solving"); expect(prompt).toContain("[unreadable]"); expect(prompt).toContain("not a verified citation");
  });
});
