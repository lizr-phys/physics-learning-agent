import { NextRequest, NextResponse } from "next/server";
import { imageRequestOwner } from "@/lib/image-request-owner";
import { ImageInputError, readStoredImage } from "@/lib/image-store";
import { IMAGE_LIMITS, sanitizeImageAttachments } from "@/lib/image-attachments";
import { addPersonalDocument, listPersonalDocuments } from "@/lib/personal-knowledge";
import { withKeyedLock } from "@/lib/async-lock";
import { createHash } from "node:crypto";
import { readJsonRequest, RequestBodyError } from "@/lib/request-body";
import { courseOptions } from "@/data/courses";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { CourseId } from "@/types/learning";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const { user, owner } = await imageRequestOwner(request);
    if (!user) return NextResponse.json({ error: "Sign in to save photo problems." }, { status: 401 });
    if (!consumeRateLimit(`photo-problem:${user.id}`, 30, 10 * 60 * 1000).allowed) return NextResponse.json({ error: "Too many saves. Try again shortly." }, { status: 429 });
    const body = await readJsonRequest<Record<string, unknown>>(request, 96 * 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ImageInputError("The photo problem is invalid.");
    const images = sanitizeImageAttachments(body.images);
    if (body.reviewed !== true || (body.kind !== "exam" && body.kind !== "homework") || typeof body.content !== "string" || body.content.trim().length < 20 || body.content.length > 20_000) throw new ImageInputError("Check the recognized text and confirm your review before saving (20–20,000 characters).");
    if (!Array.isArray(body.images) || !images?.length || images.length !== body.images.length || images.length > IMAGE_LIMITS.perMessage) throw new ImageInputError("Attach one to four valid source images.");
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const sourceNote = typeof body.sourceNote === "string" ? body.sourceNote.trim().slice(0, 500) : "";
    const course = courseOptions.some(course => course.id === body.course) ? body.course as CourseId : undefined;
    const content = body.content.trim(), kind = body.kind;
    const topic = typeof body.topic === "string" ? body.topic.slice(0, 240) : undefined;
    const captureId = createHash("sha256").update(JSON.stringify({title,sourceNote,course,topic,content,kind,images:images.map(image => image.id)})).digest("hex");
    const document = await withKeyedLock(`workspace:${user.id}`, async () => {
      const existing = (await listPersonalDocuments(user.id)).find(document => document.problem?.captureId === captureId);
      if (existing) return existing;
      const ownedImages = await Promise.all(images.map(async image => (await readStoredImage(owner!, image.id)).image));
      return addPersonalDocument({ userId: user.id, fileName: `${title || (kind === "exam" ? "Exam problem" : "Homework problem")}.md`, mimeType: "text/markdown", course, topic,
        description: `${kind === "exam" ? "Exam" : "Homework"} photo · Text reviewed by the user`, data: Buffer.from(content, "utf8"),
        problem: { kind, title: title || (kind === "exam" ? "Exam problem" : "Homework problem"), images: ownedImages, sourceNote: sourceNote || undefined, reviewedAt: Date.now(), captureId } });
    });
    return NextResponse.json({ document }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof ImageInputError || error instanceof RequestBodyError;
    return NextResponse.json({ error: known ? error.message : "The photo problem could not be saved. Your draft is retained." }, { status: known ? error.status : 503 });
  }
}
