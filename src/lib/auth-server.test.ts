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

  it("serializes concurrent registrations without losing users or duplicating email addresses", async () => {
    const [first, second] = await Promise.all([
      registerUser({
        email: "first@example.com",
        name: "First Student",
        password: "physics123",
      }),
      registerUser({
        email: "second@example.com",
        name: "Second Student",
        password: "physics123",
      }),
    ]);

    await expect(authenticateUser(first.email, "physics123")).resolves.toMatchObject({
      id: first.id,
    });
    await expect(authenticateUser(second.email, "physics123")).resolves.toMatchObject({
      id: second.id,
    });

    const duplicateAttempts = await Promise.allSettled([
      registerUser({
        email: "duplicate@example.com",
        name: "Duplicate One",
        password: "physics123",
      }),
      registerUser({
        email: "duplicate@example.com",
        name: "Duplicate Two",
        password: "physics123",
      }),
    ]);

    expect(duplicateAttempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(duplicateAttempts.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
