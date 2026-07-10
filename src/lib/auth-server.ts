import { promises as fs } from "fs";
import path from "path";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import type { NextRequest, NextResponse } from "next/server";

import { withKeyedLock } from "@/lib/async-lock";

const scrypt = promisify(scryptCallback);

export const sessionCookieName = "pla_session";

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  createdAt: number;
};

type UserRecord = SafeUser & {
  passwordHash: string;
  passwordSalt: string;
};

type SessionRecord = {
  tokenHash: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
};

const thirtyDaysInSeconds = 60 * 60 * 24 * 30;

function dataRoot() {
  return process.env.PLA_DATA_DIR || path.join(process.cwd(), ".pla-data");
}

function authDir() {
  return path.join(dataRoot(), "auth");
}

function usersPath() {
  return path.join(authDir(), "users.json");
}

function sessionsPath() {
  return path.join(authDir(), "sessions.json");
}

async function ensureAuthDir() {
  await fs.mkdir(authDir(), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureAuthDir();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

async function readUsers() {
  return readJsonFile<UserRecord[]>(usersPath(), []);
}

async function writeUsers(users: UserRecord[]) {
  await writeJsonFile(usersPath(), users);
}

async function readSessions() {
  return readJsonFile<SessionRecord[]>(sessionsPath(), []);
}

async function writeSessions(sessions: SessionRecord[]) {
  await writeJsonFile(sessionsPath(), sessions);
}

function createId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePassword(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return {
    hash: derived.toString("hex"),
    salt,
  };
}

async function verifyPassword(password: string, user: UserRecord) {
  const { hash } = await hashPassword(password, user.passwordSalt);
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(hash, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim().slice(0, 80);
  const password = input.password;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  if (name.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }

  if (!validatePassword(password)) {
    throw new Error("Password must be at least 8 characters and include a letter and a number.");
  }

  const { hash, salt } = await hashPassword(password);

  return withKeyedLock("auth:users", async () => {
    const users = await readUsers();

    if (users.some((user) => user.email === email)) {
      throw new Error("An account with this email already exists.");
    }

    const user: UserRecord = {
      id: createId("user"),
      email,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: Date.now(),
    };

    await writeUsers([...users, user]);
    return toSafeUser(user);
  });
}

export async function authenticateUser(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const users = await readUsers();
  const user = users.find((item) => item.email === email);

  if (!user || !(await verifyPassword(password, user))) {
    throw new Error("Email or password is incorrect.");
  }

  return toSafeUser(user);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();

  await withKeyedLock("auth:sessions", async () => {
    const sessions = await readSessions();
    const activeSessions = sessions.filter((session) => session.expiresAt > now);

    activeSessions.push({
      tokenHash: hashToken(token),
      userId,
      createdAt: now,
      expiresAt: now + thirtyDaysInSeconds * 1000,
    });

    await writeSessions(activeSessions);
  });
  return token;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: thirtyDaysInSeconds,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getUserFromSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const now = Date.now();
  const tokenHash = hashToken(token);
  const sessions = await readSessions();
  const session = sessions.find(
    (item) => item.tokenHash === tokenHash && item.expiresAt > now,
  );

  if (!session) {
    return null;
  }

  const users = await readUsers();
  const user = users.find((item) => item.id === session.userId);
  return user ? toSafeUser(user) : null;
}

export async function getUserFromRequest(request: NextRequest) {
  return getUserFromSessionToken(request.cookies.get(sessionCookieName)?.value);
}

export async function deleteSession(token?: string | null) {
  if (!token) {
    return;
  }

  const tokenHash = hashToken(token);

  await withKeyedLock("auth:sessions", async () => {
    const sessions = await readSessions();
    await writeSessions(sessions.filter((session) => session.tokenHash !== tokenHash));
  });
}
