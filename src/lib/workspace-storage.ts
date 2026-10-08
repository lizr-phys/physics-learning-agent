"use client";

import { mergeWorkspaceTombstones } from "@/lib/workspace-sync";

export type WorkspaceIdentity = { ownerId: string | null; authEpoch: string };
export const workspaceIdentityKey = "pla.workspace.identity.v2";

/** Server acknowledgement bookkeeping refreshes peers without creating another save operation. */
export function workspaceMutationRequiresSync(key: string, oldValue: string | null, newValue: string | null) {
  if (oldValue === newValue) return false;
  if (/^journal\.(?:sessions|practice)\.writer\./.test(key) || key.startsWith("sync.preference-change.")) return newValue !== null;
  if (key === "sync.v2") {
    try { return JSON.stringify(JSON.parse(oldValue ?? "{}").tombstones ?? {}) !== JSON.stringify(JSON.parse(newValue ?? "{}").tombstones ?? {}); }
    catch { return true; }
  }
  if (key.startsWith("sync.") || key.startsWith("journal.")) return false;
  return ["pla.chat.sessions.v1", "pla.practice.history.v1", "pla.learning.profile.v1", "pla.deepseek.model", "pla.onboarding.dismissed.v1"].includes(key)
    || key.startsWith("pla.preferences.") || key.startsWith("pla.clientProvider.");
}

export type WorkspacePreferenceChanges = {
  preferences: Record<string, { operationId: string; updatedAt: number; value?: string | null }>;
  providerPreferences: Record<string, { operationId: string; updatedAt: number; value?: string | null }>;
};
const preferenceKeys: Record<string, { group: keyof WorkspacePreferenceChanges; field: string }> = {
  "pla.preferences.answerDepth.v1": { group: "preferences", field: "answerDepth" },
  "pla.preferences.knowledgeMode.v1": { group: "preferences", field: "knowledgeMode" },
  "pla.onboarding.dismissed.v1": { group: "preferences", field: "onboardingDismissed" },
  "pla.deepseek.model": { group: "preferences", field: "selectedModel" },
  ...Object.fromEntries(["enabled", "provider", "label", "baseUrl", "model"].map((field) =>
    [`pla.clientProvider.${field}`, { group: "providerPreferences" as const, field }])),
};
type StorageTransaction = { identity: WorkspaceIdentity; writes: Map<string, string | null>; conditions: Map<string, string | null>; applyingSnapshot: boolean };
let transaction: StorageTransaction | undefined;

export function getWorkspacePreferenceChanges(): WorkspacePreferenceChanges {
  const changes: WorkspacePreferenceChanges = { preferences: {}, providerPreferences: {} };
  try {
    const parsed = JSON.parse(workspaceStorage().getItem("sync.preference-changes.v2") ?? "null");
    if (parsed) { changes.preferences = parsed.preferences ?? {}; changes.providerPreferences = parsed.providerPreferences ?? {}; }
    for (const key of workspaceStorageKeys("sync.preference-change.")) {
      const value = JSON.parse(workspaceStorage().getItem(key) ?? "null");
      if (!value || !["preferences", "providerPreferences"].includes(value.group) || !preferenceKeys[value.storageKey]) continue;
      Object.defineProperty(changes[value.group as keyof WorkspacePreferenceChanges], value.field, {
        value: { operationId: value.operationId, updatedAt: value.updatedAt, value: value.value }, configurable: true, enumerable: true, writable: true,
      });
    }
  } catch { /* No acknowledged modification provenance exists in older caches. */ }
  return changes;
}

export function saveWorkspacePreferenceChanges(changes: WorkspacePreferenceChanges, original: WorkspacePreferenceChanges = changes) {
  for (const key of workspaceStorageKeys("sync.preference-change.")) {
    const raw = workspaceStorage().getItem(key);
    const value = JSON.parse(raw ?? "null");
    if (!value) continue;
    const current = changes[value.group as keyof WorkspacePreferenceChanges]?.[value.field];
    const captured = original[value.group as keyof WorkspacePreferenceChanges]?.[value.field];
    if (!current && captured?.operationId === value.operationId) workspaceStorage().removeItemIfUnchanged(key, raw);
  }
  // Legacy aggregate provenance is retained only for records without an individual operation key.
  const individual = new Set(workspaceStorageKeys("sync.preference-change."));
  for (const group of ["preferences", "providerPreferences"] as const) {
    for (const field of Object.keys(changes[group])) if (individual.has(`sync.preference-change.${group}.${field}`)) delete changes[group][field];
  }
  workspaceStorage().setItem("sync.preference-changes.v2", JSON.stringify(changes));
}

function markPreferenceChange(key: string) {
  const field = preferenceKeys[key];
  if (!field || transaction?.applyingSnapshot) return;
  workspaceStorage().setItem(`sync.preference-change.${field.group}.${field.field}`, JSON.stringify({ ...field,
    storageKey: key, value: workspaceStorage().getItem(key), updatedAt: Date.now(), operationId: crypto.randomUUID() }));
}

/** Stage synchronous mutations, publish events after commit, and restore prior values on quota failure. */
export function runWorkspaceTransaction<T>(callback: () => T, options: { applyingSnapshot?: boolean } = {}): T {
  if (transaction) return callback();
  const identity = getWorkspaceIdentity();
  const active: StorageTransaction = { identity, writes: new Map(), conditions: new Map(), applyingSnapshot: Boolean(options.applyingSnapshot) };
  const dispatch = window.dispatchEvent;
  const events: Event[] = [];
  transaction = active;
  window.dispatchEvent = (event: Event) => { events.push(event); return true; };
  const previous = new Map<string, string | null>();
  const applied: string[] = [];
  let result: T;
  try {
    result = callback();
    const writes = [...active.writes].sort(([left], [right]) => Number(left.endsWith(".sync.v2")) - Number(right.endsWith(".sync.v2")));
    for (const [key, stagedValue] of writes) {
      if (!isWorkspaceCurrent(identity)) throw new DOMException("Workspace changed", "AbortError");
      const before = window.localStorage.getItem(key);
      if (active.conditions.has(key) && before !== active.conditions.get(key)) continue;
      let value = stagedValue;
      if (value && (key.endsWith(".sync.acknowledged.v2") || key.includes(".journal."))) {
        const incoming = JSON.parse(value); const current = before ? JSON.parse(before) : undefined;
        if ((key.endsWith(".sync.acknowledged.v2") || incoming.kind === "acknowledged")
          && typeof current?.revision === "number" && current.revision > (incoming.revision ?? 0)) continue;
      }
      if (key.endsWith(".sync.v2") && value) {
        const incoming = JSON.parse(value); const current = before ? JSON.parse(before) : {};
        value = JSON.stringify({ ...incoming, revision: Math.max(incoming.revision ?? 0, current.revision ?? 0),
          tombstones: mergeWorkspaceTombstones(current.tombstones, incoming.tombstones) });
      }
      active.writes.set(key, value);
      previous.set(key, before);
      if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value);
      applied.push(key);
    }
    if (!isWorkspaceCurrent(identity)) throw new DOMException("Workspace changed", "AbortError");
  } catch (error) {
    for (const key of [...applied].reverse()) {
      // Another tab's committed write belongs to that tab and must not be undone by this rollback.
      if (window.localStorage.getItem(key) !== active.writes.get(key)) continue;
      const value = previous.get(key) ?? null;
      if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value);
    }
    transaction = undefined; window.dispatchEvent = dispatch;
    if (!(error instanceof Error && error.name === "AbortError")) {
      dispatch.call(window, new CustomEvent("pla:storage-failed", { detail: "Storage write failed. Previous workspace data and revision were retained." }));
    }
    throw error;
  } finally {
    transaction = undefined; window.dispatchEvent = dispatch;
  }
  for (const event of new Map(events.map((event) => [event.type, event])).values()) dispatch.call(window, event);
  return result;
}

export function getWorkspaceIdentity(): WorkspaceIdentity {
  if (typeof window === "undefined") return { ownerId: null, authEpoch: "guest" };
  try {
    const raw = window.localStorage.getItem(workspaceIdentityKey);
    const value = raw ? JSON.parse(raw) : null;
    if (value && typeof value.authEpoch === "string") return value;
  } catch { /* Keep unassigned legacy storage untouched. */ }
  return { ownerId: null, authEpoch: "guest" };
}

export function isWorkspaceCurrent(identity: WorkspaceIdentity) {
  const current = getWorkspaceIdentity();
  return current.ownerId === identity.ownerId && current.authEpoch === identity.authEpoch;
}

export function workspaceKey(key: string, ownerId = getWorkspaceIdentity().ownerId) {
  return `pla.workspace.${ownerId ? encodeURIComponent(ownerId) : "guest"}.${key}`;
}

export function workspaceStorage(ownerId?: string | null) {
  return {
    getItem: (key: string) => {
      const physicalKey = workspaceKey(key, ownerId === undefined ? transaction?.identity.ownerId : ownerId);
      if (transaction?.writes.has(physicalKey)) return transaction.writes.get(physicalKey) ?? null;
      const field = preferenceKeys[key];
      if (field) {
        const markerKey = workspaceKey(`sync.preference-change.${field.group}.${field.field}`, ownerId === undefined ? transaction?.identity.ownerId : ownerId);
        const marker = transaction?.writes.has(markerKey) ? transaction.writes.get(markerKey) : window.localStorage.getItem(markerKey);
        try {
          const change = marker ? JSON.parse(marker) : undefined;
          if (change && Object.hasOwn(change, "value")) return change.value as string | null;
        } catch { /* Fall back to the preserved physical value if a marker is unreadable. */ }
      }
      return window.localStorage.getItem(physicalKey);
    },
    setItem: (key: string, value: string): void => {
      if (!transaction && (preferenceKeys[key] || key === "sync.v2")) {
        return runWorkspaceTransaction(() => workspaceStorage().setItem(key, value));
      }
      if (transaction) {
        transaction.writes.set(workspaceKey(key, transaction.identity.ownerId), value);
        markPreferenceChange(key); return;
      }
      try { window.localStorage.setItem(workspaceKey(key), value); markPreferenceChange(key); }
      catch (error) {
        window.dispatchEvent(new CustomEvent("pla:storage-failed", { detail: "Storage full. Export or remove records before saving more." }));
        throw error;
      }
    },
    removeItem: (key: string): void => {
      if (!transaction && preferenceKeys[key]) return runWorkspaceTransaction(() => workspaceStorage().removeItem(key));
      if (transaction) transaction.writes.set(workspaceKey(key, transaction.identity.ownerId), null);
      else window.localStorage.removeItem(workspaceKey(key));
      markPreferenceChange(key);
    },
    removeItemIfUnchanged: (key: string, expected: string | null): void => {
      if (!transaction) return runWorkspaceTransaction(() => workspaceStorage().removeItemIfUnchanged(key, expected));
      const physicalKey = workspaceKey(key, transaction.identity.ownerId);
      transaction.conditions.set(physicalKey, expected); transaction.writes.set(physicalKey, null);
    },
  };
}

export function workspaceStorageKeys(prefix = "", ownerId?: string | null) {
  const namespace = workspaceKey("", ownerId === undefined ? transaction?.identity.ownerId : ownerId);
  const result = new Set<string>();
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(namespace + prefix)) result.add(key.slice(namespace.length));
  }
  for (const [key, value] of transaction?.writes ?? []) {
    if (!key.startsWith(namespace + prefix)) continue;
    if (value === null) result.delete(key.slice(namespace.length)); else result.add(key.slice(namespace.length));
  }
  return [...result];
}

export function switchWorkspace(ownerId: string | null, force = false) {
  const current = getWorkspaceIdentity();
  if (current.ownerId === ownerId && !force) return current;
  // Cancel in the old namespace before publishing the new identity.
  window.dispatchEvent(new Event("pla:workspace-will-change"));
  window.sessionStorage?.removeItem("pla.clientProvider.apiKey");
  const next = { ownerId, authEpoch: crypto.randomUUID() };
  window.localStorage.setItem(workspaceIdentityKey, JSON.stringify(next));
  window.dispatchEvent(new Event("pla:workspace-changed"));
  window.dispatchEvent(new Event("pla:sessions-changed"));
  return next;
}

export function announceAuthChange(ownerId: string | null) {
  switchWorkspace(ownerId, true);
  window.dispatchEvent(new Event("pla:auth-changed"));
}
