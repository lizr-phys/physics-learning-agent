import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookie, deleteSession, sessionCookieName } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await deleteSession(request.cookies.get(sessionCookieName)?.value);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
