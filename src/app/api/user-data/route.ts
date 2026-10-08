import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth-server";
import { readJsonRequest, RequestBodyError } from "@/lib/request-body";
import { readUserData, writeUserData, WorkspaceConflictError, WorkspaceWriteError } from "@/lib/user-data-server";
import { WorkspaceQuotaError } from "@/lib/workspace-sync";

export const runtime = "nodejs";
export const maxDuration = 30;

function ownerMismatch(request: NextRequest, authenticatedUserId: string) {
  const expectedOwner = request.headers.get("X-PLA-Workspace-Owner");
  if (expectedOwner && expectedOwner !== authenticatedUserId) {
    return NextResponse.json({ error: "The signed-in account changed. Reload this workspace before syncing.", code: "WORKSPACE_OWNER_CHANGED" }, { status: 409 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to sync workspace data." }, { status: 401 });
  }

  const mismatch = ownerMismatch(request, user.id);
  if (mismatch) return mismatch;

  const data = await readUserData(user.id);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to sync workspace data." }, { status: 401 });
  }

  const mismatch = ownerMismatch(request, user.id);
  if (mismatch) return mismatch;

  try {
    const body = await readJsonRequest(request, 8 * 1024 * 1024);
    const data = await writeUserData(user.id, body);
    return NextResponse.json({ ok: true, data, revision: data.revision, updatedAt: data.updatedAt });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof WorkspaceConflictError) {
      return NextResponse.json({ error: error.message, code: error.code, data: error.data }, { status: error.status });
    }
    if (error instanceof WorkspaceQuotaError || error instanceof WorkspaceWriteError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to save workspace data." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
