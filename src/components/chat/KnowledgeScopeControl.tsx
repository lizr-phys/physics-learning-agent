"use client";
import { useEffect, useState } from "react";
import { getWorkspaceIdentity, isWorkspaceCurrent } from "@/lib/workspace-storage";

type DocumentChoice = { id: string; userId: string; fileName: string; indexStatus: string };
export function KnowledgeScopeControl({ documentIds, courseOnly, onChange }: {
  documentIds: string[]; courseOnly: boolean;
  onChange: (ids: string[], courseOnly: boolean) => void;
}) {
  const [documents, setDocuments] = useState<DocumentChoice[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const identity = getWorkspaceIdentity(); const controller = new AbortController();
    if (!identity.ownerId) return;
    async function load() {
      try {
        const response = await fetch("/api/knowledge/documents", { cache: "no-store", signal: controller.signal, headers: { "X-PLA-Workspace-Owner": identity.ownerId! } });
        if (!response.ok) throw new Error("Unable to load document choices.");
        const data = await response.json();
        if (!isWorkspaceCurrent(identity) || controller.signal.aborted) return;
        setDocuments((data.documents ?? []).filter((document: DocumentChoice) => document.userId === identity.ownerId && document.indexStatus === "indexed"));
      } catch { if (!controller.signal.aborted && isWorkspaceCurrent(identity)) setStatus("Document choices unavailable. Try the Personal Knowledge Base page."); }
    }
    void load(); return () => controller.abort();
  }, []);
  return <details className="mt-2 text-xs text-zinc-500">
    <summary className="cursor-pointer">Material scope{documentIds.length ? ` · ${documentIds.length} selected` : ""}</summary>
    <div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded border border-zinc-200 p-3">
      <p>Selected excerpts may be sent to your chosen model provider.</p>
      <label className="flex gap-2"><input type="checkbox" checked={courseOnly} onChange={event => onChange(documentIds, event.target.checked)} />Current course only</label>
      <p>{documents.length ? "All indexed documents are eligible unless you select specific documents." : status || "Sign in and index a document to choose materials."}</p>
      {documents.map(document => <label key={document.id} className="flex items-start gap-2">
        <input type="checkbox" checked={documentIds.includes(document.id)} onChange={event => onChange(event.target.checked ? [...documentIds, document.id] : documentIds.filter(id => id !== document.id), courseOnly)} />
        <span className="break-all">{document.fileName}</span>
      </label>)}
    </div>
  </details>;
}
