import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ user: { id: "test-account-a" } as { id: string } | null }));
vi.mock("@/lib/auth-server", () => ({ getUserFromRequest: async () => identity.user }));

import { GET, POST, PUT } from "@/app/api/user-data/route";
import { readUserData } from "@/lib/user-data-server";

let tempDir = "";
let previousDataDir: string | undefined;
beforeEach(async () => {
  previousDataDir = process.env.PLA_DATA_DIR;
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pla-workspace-route-"));
  process.env.PLA_DATA_DIR = tempDir;
  identity.user = { id: "test-account-a" };
});
afterEach(async () => {
  process.env.PLA_DATA_DIR = previousDataDir;
  await rm(tempDir, { recursive: true, force: true });
});

const request = (method: string, owner = "test-account-a", body?: object) => new NextRequest("http://localhost/api/user-data", {
  method,
  headers: { "X-PLA-Workspace-Owner": owner, "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined,
});

describe("workspace route authorization and conflicts", () => {
  it("rejects a stale account owner on read, write, and beacon", async () => {
    identity.user = { id: "test-account-b" };
    expect((await GET(request("GET"))).status).toBe(409);
    expect((await PUT(request("PUT", "test-account-a", { revision: 0, operationId: "a", sessions: [] }))).status).toBe(409);
    expect((await POST(request("POST", "test-account-a", { revision: 0, operationId: "a", sessions: [] }))).status).toBe(409);
    expect((await readUserData("test-account-b")).revision).toBe(0);
  });

  it("returns the current account snapshot for a stale revision", async () => {
    const body = { revision: 0, operationId: "initial", sessions: [] };
    const saved = await PUT(request("PUT", "test-account-a", body));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ ok: true, revision: 1, data: { revision: 1 } });
    const stale = await PUT(request("PUT", "test-account-a", { ...body, operationId: "another-device" }));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "WORKSPACE_CONFLICT", data: { revision: 1 } });
  });

  it("responds with an explicit quota failure and leaves data untouched", async () => {
    const oversized = { revision: 0, operationId: "too-many", sessions: Array.from({ length: 81 }, (_, index) => ({ id: String(index), title: String(index), messages: [] })) };
    const response = await PUT(request("PUT", "test-account-a", oversized));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "WORKSPACE_QUOTA_EXCEEDED" });
    expect((await readUserData("test-account-a")).sessions).toEqual([]);
  });

  it("requires authentication and prevents caching private workspace data", async () => {
    const response = await GET(request("GET"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    identity.user = null;
    expect((await GET(request("GET"))).status).toBe(401);
  });
});
