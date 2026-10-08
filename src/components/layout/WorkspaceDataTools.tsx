"use client";
import { useState } from "react";
import { collectClientUserDataSnapshot } from "@/lib/user-data-client";
import { workspaceStorage } from "@/lib/workspace-storage";
import { buildPilotFeedbackReport } from "@/evaluation/feedback-report";
import type { WorkspaceConflict } from "@/lib/workspace-sync";
import { WorkspaceImages } from "@/components/layout/WorkspaceImages";

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:"application/json"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}
export function WorkspaceDataTools() {
  const [conflicts, setConflicts] = useState<WorkspaceConflict[]>([]);
  function loadConflicts() {
    try { setConflicts(JSON.parse(workspaceStorage().getItem("sync.conflicts.v2") ?? "[]")); }
    catch { setConflicts([]); }
  }
  return <details className="border-t border-zinc-200 py-4">
    <summary className="cursor-pointer text-sm font-semibold text-zinc-950">Workspace data</summary>
    <p className="mt-2 text-xs leading-5 text-zinc-600">Export conversations, practice sets and source excerpts. Images are references; save copies below. Provider keys are excluded. Keep the export private.</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <button type="button" className="rounded border border-zinc-200 px-3 py-2" onClick={() => download("physics-workspace.json", collectClientUserDataSnapshot())}>Export workspace</button>
      <button type="button" className="rounded border border-zinc-200 px-3 py-2" onClick={() => download("physics-pilot-summary.json", buildPilotFeedbackReport(collectClientUserDataSnapshot()))}>Export feedback summary</button>
    </div>
    <p className="mt-2 text-xs leading-5 text-zinc-500">The feedback summary excludes identities and learning text. Sharing is optional; no analytics are sent automatically.</p>
    <WorkspaceImages />
    <details onToggle={event => { if (event.currentTarget.open) loadConflicts(); }} className="mt-3 text-xs text-zinc-600">
      <summary className="cursor-pointer">Review synchronization conflicts</summary>
      {conflicts.length ? <ul className="mt-2 space-y-2">{conflicts.map((conflict, index) => <li key={index} className="break-all">{conflict.entity} · {conflict.id} · {conflict.field}{conflict.preservedId ? ` · preserved copy: ${conflict.preservedId}` : " · alternate values preserved in the workspace export"}</li>)}</ul> : <p className="mt-2">No synchronization conflicts recorded.</p>}
    </details>
  </details>;
}
