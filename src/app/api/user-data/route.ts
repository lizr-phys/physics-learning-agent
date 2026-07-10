import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth-server";
import { readJsonRequest, RequestBodyError } from "@/lib/request-body";
import { readUserData, writeUserData } from "@/lib/user-data-server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to sync workspace data." }, { status: 401 });
  }

  const data = await readUserData(user.id);
  return NextResponse.json({ data });
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to sync workspace data." }, { status: 401 });
  }

  try {
    const body = await readJsonRequest(request, 8 * 1024 * 1024);
    const data = await writeUserData(user.id, body);
    return NextResponse.json({ ok: true, updatedAt: data.updatedAt });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to save workspace data." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
