import { NextRequest, NextResponse } from "next/server";

import { createSession, registerUser, setSessionCookie } from "@/lib/auth-server";

export const runtime = "nodejs";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const user = await registerUser({
      email: readString(body.email),
      name: readString(body.name),
      password: typeof body.password === "string" ? body.password : "",
    });
    const token = await createSession(user.id);
    const response = NextResponse.json({ user });

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create account." },
      { status: 400 },
    );
  }
}
