import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth-server";
import { getPersonalKnowledgeSource } from "@/lib/personal-knowledge";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to inspect personal sources." }, { status: 401, headers });
  const owner = request.headers.get("X-PLA-Workspace-Owner");
  if (owner && owner !== user.id) return NextResponse.json({ error: "The signed-in account changed. Reload this workspace." }, { status: 409, headers });
  const { id } = await context.params;
  if (!id || id.length > 200) return NextResponse.json({ error: "Source not found." }, { status: 404, headers });
  try {
    request.signal.throwIfAborted();
    const source = await getPersonalKnowledgeSource(user.id, id);
    request.signal.throwIfAborted();
    if (!source) return NextResponse.json({ error: "Source not found." }, { status: 404, headers });
    return NextResponse.json({ source }, { headers });
  } catch (error) {
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return NextResponse.json({ error: "Source lookup cancelled." }, { status: 499, headers });
    }
    return NextResponse.json({ error: "Unable to inspect this source. Please retry." }, { status: 503, headers });
  }
}
