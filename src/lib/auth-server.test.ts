import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  authenticateUser,
  createSession,
  getUserFromSessionToken,
  registerUser,
} from "@/lib/auth-server";

let tempDir = "";
let previousDataDir: string | undefined;

beforeEach(async () => {
  previousDataDir = process.env.PLA_DATA_DIR;
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pla-auth-"));
  process.env.PLA_DATA_DIR = tempDir;
});

afterEach(async () => {
  process.env.PLA_DATA_DIR = previousDataDir;
  await rm(tempDir, { recursive: true, force: true });
});

describe("local auth store", () => {
  it("registers a user, verifies the password, and resolves a session token", async () => {
    const user = await registerUser({
      email: "Student@Example.com",
      name: "Physics Student",
      password: "physics123",
    });

    expect(user.email).toBe("student@example.com");

    const authenticated = await authenticateUser("student@example.com", "physics123");
    const token = await createSession(authenticated.id);
    const sessionUser = await getUserFromSessionToken(token);

    expect(sessionUser?.id).toBe(user.id);
    await expect(authenticateUser("student@example.com", "wrong-password")).rejects.toThrow();
  });
});
