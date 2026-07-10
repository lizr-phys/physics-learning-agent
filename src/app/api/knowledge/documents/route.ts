import { NextRequest, NextResponse } from "next/server";

import { courseOptions } from "@/data/courses";
import { getUserFromRequest } from "@/lib/auth-server";
import {
  addPersonalDocument,
  listPersonalDocuments,
  maxPersonalUploadBytes,
} from "@/lib/personal-knowledge";
import type { CourseId } from "@/types/learning";

export const runtime = "nodejs";
export const maxDuration = 120;

const courseIds = new Set(courseOptions.map((course) => course.id));

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to view your knowledge base." }, { status: 401 });
  }

  return NextResponse.json({ documents: await listPersonalDocuments(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Sign in to upload documents." }, { status: 401 });
  }

  try {
    const declaredLength = Number(request.headers.get("content-length"));

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maxPersonalUploadBytes + 1024 * 1024
    ) {
      return NextResponse.json(
        { error: "File is too large. The current local prototype accepts files up to 12 MB." },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
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

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload document." },
      { status: 400 },
    );
  }
}
