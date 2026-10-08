"use client";
import { workspaceStorage } from "@/lib/workspace-storage";

export type WorkspaceTombstones = {
  sessions: Record<string, { deletedAt: number; operationId: string }>;
  practiceHistory: Record<string, { deletedAt: number; operationId: string }>;
};
export function getWorkspaceMetadata(): { revision: number; tombstones: WorkspaceTombstones } {
  try {
    const raw = workspaceStorage().getItem("sync.v2");
    if (raw) return JSON.parse(raw);
  } catch { /* Old workspaces start at revision zero. */ }
  return { revision: 0, tombstones: { sessions: {}, practiceHistory: {} } };
}
export function saveWorkspaceMetadata(metadata: ReturnType<typeof getWorkspaceMetadata>) {
  workspaceStorage().setItem("sync.v2", JSON.stringify(metadata));
}
export function tombstoneSession(id: string) {
  const metadata = getWorkspaceMetadata();
  metadata.tombstones.sessions[id] = { deletedAt: Date.now(), operationId: crypto.randomUUID() };
  saveWorkspaceMetadata(metadata);
}
