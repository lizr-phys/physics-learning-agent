import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth-server";
import { deletePersonalDocument, readPersonalProblem, reindexPersonalDocument } from "@/lib/personal-knowledge";
import { imageRequestOwner } from "@/lib/image-request-owner";
import { ImageInputError } from "@/lib/image-store";

export const runtime = "nodejs";
export const maxDuration = 120;
const noStore = { "Cache-Control": "private, no-store" };

function ownerChanged(request: NextRequest, userId?: string) {
  const expected = request.headers.get("X-PLA-Workspace-Owner");
  return Boolean(expected && expected !== (userId ?? "guest"));
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await imageRequestOwner(request);
    if (!user) return NextResponse.json({ error: "Sign in to view photo problems." }, { status: 401 });
    const result = await readPersonalProblem(user.id, (await context.params).id);
    return NextResponse.json(result ?? { error: "Photo problem not found." }, { status: result ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof ImageInputError ? error.message : "The photo problem could not be loaded." }, { status: error instanceof ImageInputError ? error.status : 503 }); }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);
  if (ownerChanged(request, user?.id)) return NextResponse.json({ error: "The account changed. Open the library again." }, { status: 409, headers: noStore });

  if (!user) {
    return NextResponse.json({ error: "Sign in to reindex documents." }, { status: 401 });
  }

  const { id } = await context.params;
  const document = await reindexPersonalDocument(user.id, id);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ document }, { headers: noStore });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);
  if (ownerChanged(request, user?.id)) return NextResponse.json({ error: "The account changed. Open the library again." }, { status: 409, headers: noStore });

  if (!user) {
    return NextResponse.json({ error: "Sign in to delete documents." }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deletePersonalDocument(user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { headers: noStore });
}
