"use client";
import { useEffect, useRef, useState } from "react";
import { getWorkspaceIdentity, isWorkspaceCurrent } from "@/lib/workspace-storage";
import type { RagContext } from "@/types/learning";

const statusLabels: Record<string, string> = {
  disabled: "Personal materials were not used.",
  unauthenticated: "Sign in to use personal materials.",
  no_match: "No matching personal materials were found. This answer uses general knowledge.",
  failed: "Personal retrieval failed. This answer may use general knowledge; retry if sources are required.",
};
export function SourceInspector({ sources, status, selectedSource }: { sources?: RagContext["snippets"]; status?: string; selectedSource?: {index:number;version:number} }) {
  const [availability, setAvailability] = useState<Record<string, string>>({});
  const detailsRef = useRef<Record<number, HTMLDetailsElement | null>>({});
  useEffect(() => {
    const element = selectedSource ? detailsRef.current[selectedSource.index] : undefined;
    if (element) { element.open = true; element.scrollIntoView({block:"nearest"}); }
  }, [selectedSource]);
  async function verify(source: NonNullable<typeof sources>[number]) {
    if (source.kind !== "personal" || !source.sourceId) return;
    const identity = getWorkspaceIdentity();
    try {
      const response = await fetch(`/api/knowledge/sources/${encodeURIComponent(source.sourceId)}`, { cache: "no-store", headers: { "X-PLA-Workspace-Owner": identity.ownerId ?? "guest" } });
      if (!isWorkspaceCurrent(identity)) return;
      setAvailability(current => ({ ...current, [source.sourceId!]: response.ok ? "Source is available in your library." : "The source is no longer accessible. The excerpt used for this answer is preserved below." }));
    } catch { if (isWorkspaceCurrent(identity)) setAvailability(current => ({...current, [source.sourceId!]: "Unable to verify current library availability. The original excerpt is shown below."})); }
  }
  if (!sources?.length && !statusLabels[status ?? ""]) return null;
  return <div className="space-y-2 border-t border-zinc-100 pt-2 text-xs text-zinc-500" data-testid="source-inspector">
    {statusLabels[status ?? ""] ? <p>{statusLabels[status!]}</p> : null}
    {sources?.length ? <p>Sources used in this answer · open an excerpt to check support</p> : null}
    {sources?.map((source, index) => <details ref={element => { detailsRef.current[index + 1] = element; }} key={source.sourceId ?? `${source.source}-${index}`} onToggle={event => { if (event.currentTarget.open) void verify(source); }}>
      <summary className="cursor-pointer break-words">[{index + 1}] {source.source} · {source.heading}{source.locator ? ` · ${source.locator}` : ""}</summary>
      <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-3">
        <p>{availability[source.sourceId ?? ""] ?? "Original excerpt provided to the model."}</p>
        {source.sourceId ? <p className="mt-1 break-all">Source ID: {source.sourceId}</p> : null}
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-zinc-800">{source.content}</pre>
      </div>
    </details>)}
  </div>;
}
