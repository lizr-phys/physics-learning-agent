import { NextRequest, NextResponse } from "next/server";

import { courseOptions } from "@/data/courses";
import { getUserFromRequest } from "@/lib/auth-server";
import { readFormDataRequest, RequestBodyError } from "@/lib/request-body";
import {
  addPersonalDocument,
  listPersonalDocuments,
  maxPersonalUploadBytes,
} from "@/lib/personal-knowledge";
import type { CourseId } from "@/types/learning";

export const runtime = "nodejs";
export const maxDuration = 120;

const courseIds = new Set(courseOptions.map((course) => course.id));
const noStore = { "Cache-Control": "private, no-store" };

function ownerChanged(request: NextRequest, userId?: string) {
  const expected = request.headers.get("X-PLA-Workspace-Owner");
  return Boolean(expected && expected !== (userId ?? "guest"));
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (ownerChanged(request, user?.id)) return NextResponse.json({ error: "The account changed. Open the library again.", code: "WORKSPACE_OWNER_CHANGED" }, { status: 409, headers: noStore });

  if (!user) {
    return NextResponse.json({ error: "Sign in to view your knowledge base." }, { status: 401 });
  }

  try {
    return NextResponse.json({ documents: await listPersonalDocuments(user.id) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Your materials could not be loaded. Try again." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (ownerChanged(request, user?.id)) return NextResponse.json({ error: "The account changed. Open the library again.", code: "WORKSPACE_OWNER_CHANGED" }, { status: 409, headers: noStore });

  if (!user) {
    return NextResponse.json({ error: "Sign in to upload documents." }, { status: 401 });
  }

  try {
    const formData = await readFormDataRequest(request, maxPersonalUploadBytes + 1024 * 1024);
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }
    if (file.size > maxPersonalUploadBytes) {
      return NextResponse.json({ error: "Choose a document up to 12 MB." }, { status: 413 });
    }

    const courseValue = formData.get("course");
    const course =
      typeof courseValue === "string" && courseIds.has(courseValue as Exclude<CourseId, "general">)
        ? (courseValue as CourseId)
        : undefined;

    const document = await addPersonalDocument({
      userId: user.id,
      fileName: file.name,
      mimeType: file.type,
      description:
        typeof formData.get("description") === "string"
          ? (formData.get("description") as string)
          : undefined,
      course,
      topic: typeof formData.get("topic") === "string" ? (formData.get("topic") as string) : undefined,
      data: Buffer.from(await file.arrayBuffer()),
    });

    return NextResponse.json({ document }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.status === 413 ? "Choose a document up to 12 MB." : error.message, code: error.code }, { status: error.status, headers: noStore });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload document." },
      { status: 400 },
    );
  }
}
