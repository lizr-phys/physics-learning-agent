import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ user: { id: "source-account-a" } as { id: string } | null }));
vi.mock("@/lib/auth-server", () => ({ getUserFromRequest: async () => identity.user }));

import { GET } from "@/app/api/knowledge/sources/[id]/route";
import { addPersonalDocument, deletePersonalDocument, retrievePersonalKnowledge } from "@/lib/personal-knowledge";
import * as personalKnowledge from "@/lib/personal-knowledge";

let tempDir = "";
let previousDataDir: string | undefined;
beforeEach(async () => {
  previousDataDir = process.env.PLA_DATA_DIR;
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pla-source-route-"));
  process.env.PLA_DATA_DIR = tempDir;
  identity.user = { id: "source-account-a" };
});
afterEach(async () => {
  vi.restoreAllMocks();
  process.env.PLA_DATA_DIR = previousDataDir;
  await rm(tempDir, { recursive: true, force: true });
});

const request = (owner?: string) => new NextRequest("http://localhost/api/knowledge/sources/unused", {
  headers: owner ? { "X-PLA-Workspace-Owner": owner } : {},
});

describe("personal source endpoint", () => {
  it("returns the actual cited excerpt with private cache policy and no storage path", async () => {
    const document = await addPersonalDocument({ userId: "source-account-a", fileName: "my-notes.md",
      mimeType: "text/markdown", data: Buffer.from("# Green function\n\nA Green function depends on boundary conditions.") });
    const [source] = await retrievePersonalKnowledge("source-account-a", "Green function");
    const context = { params: Promise.resolve({ id: source.sourceId }) };
    const response = await GET(request("source-account-a"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.source).toMatchObject({ sourceId: source.sourceId, documentId: document.id, content: source.content, kind: "personal" });
    expect(JSON.stringify(body)).not.toContain("storedFileName");
    identity.user = { id: "source-account-b" };
    expect((await GET(request(), context)).status).toBe(404);
    expect((await GET(request("source-account-a"), context)).status).toBe(409);
    identity.user = null;
    expect((await GET(request(), context)).status).toBe(401);
    identity.user = { id: "source-account-a" };
    await deletePersonalDocument("source-account-a", document.id);
    expect((await GET(request("source-account-a"), context)).status).toBe(404);
  });

  it("rejects paths and absent source IDs without exposing another account", async () => {
    expect((await GET(request("source-account-a"), { params: Promise.resolve({ id: "../../source-account-b/uploads" }) })).status).toBe(404);
    expect((await GET(request("source-account-a"), { params: Promise.resolve({ id: "x".repeat(250) }) })).status).toBe(404);
  });

  it("reports a lookup fault separately and redacts internal error detail", async () => {
    vi.spyOn(personalKnowledge, "getPersonalKnowledgeSource").mockRejectedValueOnce(new Error("private document path and provider secret"));
    const response = await GET(request("source-account-a"), { params: Promise.resolve({ id: "synthetic-source" }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to inspect this source. Please retry." });
  });
});
