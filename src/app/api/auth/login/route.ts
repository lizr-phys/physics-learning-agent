import { NextRequest, NextResponse } from "next/server";

import { authenticateUser, createSession, setSessionCookie } from "@/lib/auth-server";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { readJsonRequest, RequestBodyError } from "@/lib/request-body";

export const runtime = "nodejs";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit(
    `auth:login:${getRequestClientKey(request)}`,
    10,
    10 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const body = await readJsonRequest<Record<string, unknown>>(request, 16 * 1024);
    const user = await authenticateUser(
      readString(body.email),
      typeof body.password === "string" ? body.password : "",
    );
    const token = await createSession(user.id);
    const response = NextResponse.json({ user });

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in." },
      { status: 401 },
    );
  }
}
