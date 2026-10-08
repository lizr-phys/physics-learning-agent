"use client";

import { useEffect, useRef, useState } from "react";
import { ImageGallery } from "@/components/common/ImageAttachments";
import { collectClientUserDataSnapshot } from "@/lib/user-data-client";
import { guestMediaToken, snapshotImageRefs } from "@/lib/image-client";
import { imageUrl } from "@/lib/image-attachments";
import { getWorkspaceIdentity, isWorkspaceCurrent } from "@/lib/workspace-storage";
import type { ImageAttachment } from "@/types/learning";

export function WorkspaceImages() {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const cancel = () => controller.current?.abort();
    window.addEventListener("pla:workspace-will-change", cancel);
    return () => { cancel(); window.removeEventListener("pla:workspace-will-change", cancel); };
  }, []);

  async function request(remove?: ImageAttachment) {
    if (busy) return;
    if (remove && snapshotImageRefs(collectClientUserDataSnapshot()).some(image => image.id === remove.id)) return;
    const identity = getWorkspaceIdentity();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError("");
    try {
      const headers: Record<string, string> = { "X-PLA-Workspace-Owner": identity.ownerId ?? "guest" };
      if (!identity.ownerId) headers["X-PLA-Guest-Media-Token"] = await guestMediaToken();
      const response = await fetch(remove ? imageUrl(remove) : "/api/images", { method: remove ? "DELETE" : "GET", headers, signal: abort.signal, cache: "no-store" });
      const body = await response.json();
      if (!isWorkspaceCurrent(identity) || abort.signal.aborted) return;
      if (!response.ok) throw new Error(body.error || "Images could not be loaded.");
      let documents: unknown[] = [];
      if (identity.ownerId) {
        const library = await fetch("/api/knowledge/documents", { cache: "no-store", headers, signal: abort.signal });
        if (!library.ok) throw new Error("The library's image references could not be verified.");
        documents = (await library.json()).documents;
      }
      if (!isWorkspaceCurrent(identity) || abort.signal.aborted) return;
      setUsedIds(new Set(snapshotImageRefs({workspace:collectClientUserDataSnapshot(),documents}).map(image => image.id)));
      setImages(current => remove ? current.filter(image => image.id !== remove.id) : body.images);
    } catch (error) {
      if (isWorkspaceCurrent(identity) && !abort.signal.aborted) setError(error instanceof Error ? error.message : "Image request failed.");
    } finally {
      if (isWorkspaceCurrent(identity) && !abort.signal.aborted) setBusy(false);
    }
  }

  return <details className="mt-3 text-xs text-zinc-600" onToggle={event => { if (event.currentTarget.open) void request(); }}>
    <summary className="cursor-pointer py-1">Manage images</summary>
    <p className="my-2 leading-5">Images stay with their workspace. Open an image to save a copy. Remove unused uploads to free the 50 MB allowance.</p>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {busy ? <p role="status">Loading…</p> : null}
    {images.length ? <ul className="space-y-3">{images.map(image => <li key={image.id} className="flex items-center gap-3">
      <ImageGallery images={[image]} compact />
      <div className="min-w-0 flex-1"><p className="truncate">{image.name}</p><p className="mt-1 text-zinc-500">{Math.ceil(image.size / 1024)} KB · {usedIds.has(image.id) ? "In use" : "Unused upload"}</p></div>
      {!usedIds.has(image.id) ? <button type="button" disabled={busy} className="px-2 py-2 underline" onClick={() => void request(image)} aria-label={`Delete unused image: ${image.name}`}>Delete</button> : null}
    </li>)}</ul> : !busy ? <p>No images in this workspace.</p> : null}
  </details>;
}
