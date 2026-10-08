"use client";

import { useEffect, useRef, useState } from "react";
import { ImageAttachmentInput } from "@/components/common/ImageAttachments";
import { courseOptions } from "@/data/courses";
import { buildPhotoProblemPrompt, type PhotoProblemDraft } from "@/lib/photo-problem";
import { sanitizeImageAttachments } from "@/lib/image-attachments";
import { getClientProviderOverride } from "@/lib/client-provider";
import { getWorkspaceIdentity, isWorkspaceCurrent, workspaceStorage } from "@/lib/workspace-storage";
import { AgentStreamError, requestAgentStream } from "@/lib/read-agent-stream";
import { createDraftCheckpoint } from "@/lib/draft-checkpoint";
import type { CourseId } from "@/types/learning";

const draftKey = "pla.photo-problem.draft.v1";
const emptyDraft: PhotoProblemDraft = { kind: "homework", title: "", images: [], topic: "", sourceNote: "", content: "" };
function loadDraft(): PhotoProblemDraft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const value = JSON.parse(workspaceStorage().getItem(draftKey) ?? "null");
    if (!value) return emptyDraft;
    return { kind: value.kind === "exam" ? "exam" : "homework", title: String(value.title ?? "").slice(0, 160), images: sanitizeImageAttachments(value.images)?.slice(0, 4) ?? [], topic: String(value.topic ?? "").slice(0, 240), sourceNote: String(value.sourceNote ?? "").slice(0, 500), content: String(value.content ?? ""), course: courseOptions.some(course => course.id === value.course) ? value.course : undefined };
  } catch { return emptyDraft; }
}

export function PhotoProblemCapture({ onSaved }: { onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(loadDraft);
  const [reviewed, setReviewed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"recognize" | "save" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inputEpoch, setInputEpoch] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const checkpoint = useRef<ReturnType<typeof createDraftCheckpoint<PhotoProblemDraft>> | null>(null);

  useEffect(() => {
    const identity = getWorkspaceIdentity();
    checkpoint.current = createDraftCheckpoint(value => {
      try { workspaceStorage().setItem(draftKey, JSON.stringify(value)); }
      catch { setError("The browser could not save this draft. Copy the text before leaving."); }
    }, () => isWorkspaceCurrent(identity));
    const leave = () => { checkpoint.current?.flush(); controller.current?.abort(); };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pla:workspace-will-change", leave);
    return () => { leave(); checkpoint.current?.discard(); window.removeEventListener("pagehide", leave); window.removeEventListener("pla:workspace-will-change", leave); };
  }, []);
  useEffect(() => { checkpoint.current?.update(draft); }, [draft]);

  function change(value: Partial<PhotoProblemDraft>) {
    setDraft(current => ({ ...current, ...value })); setReviewed(false); setNotice("");
  }
  async function recognize() {
    if (!draft.images.length || uploading || controller.current) return;
    const identity = getWorkspaceIdentity(), abort = new AbortController(); controller.current = abort;
    setBusy("recognize"); setError(""); setNotice(""); setReviewed(false);
    try {
      const result = await requestAgentStream({ message: buildPhotoProblemPrompt(draft), images: draft.images, module: "chat", taskType: "qa", course: draft.course, knowledgeMode: "never", answerDepth: "concise", model: workspaceStorage().getItem("pla.deepseek.model") ?? "deepseek-flash", clientProvider: getClientProviderOverride(), conversationId: `capture-${crypto.randomUUID()}`, assistantMessageId: "transcript", requestId: crypto.randomUUID() }, content => {
        if (isWorkspaceCurrent(identity) && controller.current === abort) setDraft(current => ({ ...current, content }));
      }, { signal: abort.signal });
      if (isWorkspaceCurrent(identity) && controller.current === abort) { setDraft(current => ({ ...current, content: result })); setNotice("Check the text, especially numbers, units and diagram labels, before saving."); }
    } catch (error) {
      if (!isWorkspaceCurrent(identity) || controller.current !== abort) return;
      if (error instanceof AgentStreamError && error.partialContent) setDraft(current => ({ ...current, content: error.partialContent }));
      setError(error instanceof Error ? error.message : "Recognition failed. Your images and draft are retained.");
    } finally {
      if (isWorkspaceCurrent(identity) && controller.current === abort) { controller.current = null; setBusy(null); }
    }
  }
  async function save() {
    if (!reviewed || !draft.content.trim() || uploading || controller.current) return;
    const identity = getWorkspaceIdentity(), abort = new AbortController(); controller.current = abort;
    setBusy("save"); setError(""); setNotice(""); checkpoint.current?.flush();
    try {
      const response = await fetch("/api/knowledge/problems", { method: "POST", headers: { "Content-Type": "application/json", "X-PLA-Workspace-Owner": identity.ownerId ?? "guest" }, body: JSON.stringify({ ...draft, reviewed }), signal: abort.signal });
      const body = await response.json();
      if (!isWorkspaceCurrent(identity) || controller.current !== abort) return;
      if (!response.ok) throw new Error(body.error || "The problem could not be saved.");
      await onSaved();
      if (!isWorkspaceCurrent(identity) || abort.signal.aborted) return;
      checkpoint.current?.discard(); workspaceStorage().removeItem(draftKey);
      setDraft(emptyDraft); setReviewed(false); setInputEpoch(value => value + 1);
      setNotice(body.document.indexStatus === "indexed" ? "Saved to your library with source images and searchable text." : "Saved with source images. Text indexing needs attention; use Reindex in the library.");
    } catch (error) { if (isWorkspaceCurrent(identity) && !abort.signal.aborted) setError(error instanceof Error ? error.message : "Save failed. Your draft is retained."); }
    finally { if (isWorkspaceCurrent(identity) && controller.current === abort) { controller.current = null; setBusy(null); } }
  }

  return <section className="border-t border-zinc-200 pt-4" data-testid="photo-problem-capture">
    <h2 className="text-sm font-semibold text-zinc-950">Photo problems</h2>
    <p className="mt-2 text-xs leading-5 text-zinc-500">Photograph an exam or homework question, check the recognized text, then save it.</p>
    <div className="mt-3 space-y-3">
      <ImageAttachmentInput key={inputEpoch} images={draft.images} onChange={images => change({ images })} onBusyChange={setUploading} disabled={Boolean(busy)} pasteTargetId="photo-problem-text" />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-600">Category<select aria-label="Problem category" value={draft.kind} onChange={event => change({ kind: event.target.value as PhotoProblemDraft["kind"] })} className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm"><option value="homework">Homework</option><option value="exam">Exam</option></select></label>
        <label className="text-xs text-zinc-600">Title<input value={draft.title} maxLength={160} onChange={event => change({ title: event.target.value })} placeholder="Optional title" className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm" /></label>
      </div>
      <details className="text-xs text-zinc-600"><summary className="cursor-pointer py-1">Course, topic and source note</summary><div className="mt-2 space-y-3">
        <label className="block">Course<select aria-label="Photo problem course" value={draft.course ?? ""} onChange={event => change({ course: event.target.value as CourseId || undefined })} className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm"><option value="">Unspecified</option>{courseOptions.map(course => <option key={course.id} value={course.id}>{course.label}</option>)}</select></label>
        <label className="block">Topic<input value={draft.topic} maxLength={240} onChange={event => change({ topic: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm" /></label>
        <label className="block">Source note<input value={draft.sourceNote} maxLength={500} onChange={event => change({ sourceNote: event.target.value })} placeholder="Your own label, date or assignment" className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm" /></label>
      </div></details>
      <button type="button" disabled={uploading || busy === "save" || !draft.images.length} onClick={busy === "recognize" ? () => controller.current?.abort() : () => void recognize()} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40" data-testid="recognize-photo">{busy === "recognize" ? "Stop recognition" : draft.content ? "Recognize again" : "Recognize and organize"}</button>
      {draft.images.length || draft.content || busy === "recognize" ? <>
        <label className="block text-xs text-zinc-600">Review and edit text<textarea id="photo-problem-text" value={draft.content} onChange={event => change({ content: event.target.value })} disabled={Boolean(busy)} placeholder="Recognize the image, or enter your own checked transcription…" rows={8} className="mt-1 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm leading-6" data-testid="photo-problem-text" /></label>
        <label className="flex items-start gap-2 text-xs leading-5 text-zinc-600"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={Boolean(busy)} className="mt-1" />I checked the question, conditions, symbols and unclear details.</label>
        <button type="button" disabled={!reviewed || Boolean(busy) || uploading || !draft.images.length} onClick={() => void save()} className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white disabled:bg-zinc-300" data-testid="save-photo-problem">{busy === "save" ? "Saving…" : "Save to library"}</button>
      </> : null}
      {error ? <p role="alert" className="text-xs leading-5 text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="text-xs leading-5 text-zinc-600">{notice}</p> : null}
    </div>
  </section>;
}
