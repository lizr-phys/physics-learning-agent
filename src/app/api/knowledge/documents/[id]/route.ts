import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth-server";
import { deletePersonalDocument, reindexPersonalDocument } from "@/lib/personal-knowledge";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to reindex documents." }, { status: 401 });
  }

  const { id } = await context.params;
  const document = await reindexPersonalDocument(user.id, id);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to delete documents." }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deletePersonalDocument(user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
