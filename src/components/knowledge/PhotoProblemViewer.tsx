"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageGallery } from "@/components/common/ImageAttachments";
import { MarkdownRenderer } from "@/components/common/LazyMarkdownRenderer";
import { getWorkspaceIdentity, isWorkspaceCurrent } from "@/lib/workspace-storage";
import { upsertToolContextSession } from "@/lib/storage";
import type { CourseId } from "@/types/learning";
import type { PhotoProblemMetadata } from "@/lib/photo-problem";

export function PhotoProblemViewer({ document }: { document: { id: string; course?: CourseId; topic?: string; problem: PhotoProblemMetadata } }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function load() {
    if (content || controller.current) return;
    const identity = getWorkspaceIdentity(), abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch(`/api/knowledge/documents/${document.id}`, { cache: "no-store", headers: { "X-PLA-Workspace-Owner": identity.ownerId ?? "guest" }, signal: abort.signal });
      const body = await response.json();
      if (!isWorkspaceCurrent(identity) || abort.signal.aborted) return;
      if (!response.ok) throw new Error(body.error || "The problem could not be opened.");
      setContent(body.content); setError("");
    } catch (error) { if (isWorkspaceCurrent(identity) && !abort.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load the note."); }
    finally { if (controller.current === abort) controller.current = null; }
  }
  function ask() {
    try {
      const session = upsertToolContextSession({ toolContext: { source: "knowledge", course: document.course, topic: document.problem.title, taskTitle: "Photo problem", generatedContent: content, images: document.problem.images, selectedItem: { type: "problem", title: document.problem.title, content }, createdAt: Date.now() }, context: { course: document.course ?? "general", taskType: "qa", knowledgeMode: "always", knowledgeDocumentIds: [document.id] } });
      router.push(`/chat?sessionId=${encodeURIComponent(session.id)}`);
    } catch { setError("This chat could not be saved. Free browser storage and try again."); }
  }
  return <details className="mt-3 text-sm" onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary className="cursor-pointer text-zinc-600">View photo problem</summary>
    <div className="mt-3 space-y-3">
      <ImageGallery images={document.problem.images} compact />
      {document.problem.sourceNote ? <p className="text-xs text-zinc-500">Your source note: {document.problem.sourceNote}</p> : null}
      <p className="text-xs text-zinc-500">Text reviewed by you; physics correctness remains unverified.</p>
      {content ? <><MarkdownRenderer content={content} /><button type="button" onClick={ask} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs">Ask about this photo problem</button></> : !error ? <p role="status" className="text-xs text-zinc-500">Loading note…</p> : null}
      {error ? <p role="alert" className="text-xs text-red-700">{error} <button type="button" onClick={() => void load()} className="underline">Retry</button></p> : null}
    </div>
  </details>;
}
