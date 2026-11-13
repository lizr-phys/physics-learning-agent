import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookie, deleteSession, getUserFromRequest, sessionCookieName } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expected = request.headers.get("X-PLA-Workspace-Owner");
  if (expected && expected !== ((await getUserFromRequest(request))?.id ?? "guest")) {
    return NextResponse.json({ error: "The active account changed. Reload before signing out.", code: "WORKSPACE_OWNER_CHANGED" }, { status: 409 });
  }
  await deleteSession(request.cookies.get(sessionCookieName)?.value);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
