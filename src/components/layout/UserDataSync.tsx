"use client";

import { useEffect, useRef, useState } from "react";
import { applyClientUserDataSnapshot, collectClientUserDataSnapshot, getWorkspaceAcknowledgement, type ClientUserDataSnapshot } from "@/lib/user-data-client";
import { getWorkspaceIdentity, isWorkspaceCurrent, switchWorkspace, workspaceIdentityKey, workspaceKey, workspaceStorage, workspaceMutationRequiresSync } from "@/lib/workspace-storage";
import { getWorkspaceMetadata, saveWorkspaceMetadata } from "@/lib/workspace-metadata";
import { importGuestImages,restoreGuestImageSession } from "@/lib/image-client";
import { getStoredSessions } from "@/lib/storage";
import { getStoredPracticeGenerations } from "@/lib/practice-history";

type SaveStatus = "Saved" | "Saving" | "Offline" | "Sync failed" | "Local only";

function importableData(legacy = false): Partial<ClientUserDataSnapshot> {
  if (!legacy) return { sessions: getStoredSessions(null), practiceHistory: getStoredPracticeGenerations(null) };
  function read(key: string) {
    const raw = window.localStorage.getItem(key);
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  }
  return { sessions: read("pla.chat.sessions.v1"), practiceHistory: read("pla.practice.history.v1") };
}

export function UserDataSync({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState("initial");
  const [status, setStatus] = useState<SaveStatus>("Local only");
  const [detail, setDetail] = useState("");
  const [offerImport, setOfferImport] = useState(false);
  const [offerLegacy, setOfferLegacy] = useState(false);
  const [importing, setImporting] = useState(false);
  const importController = useRef<AbortController | null>(null);

  useEffect(() => {
    const cancelImport = () => { importController.current?.abort(); importController.current = null; setImporting(false); };
    window.addEventListener("pla:workspace-will-change", cancelImport);
    return () => { window.removeEventListener("pla:workspace-will-change", cancelImport); importController.current?.abort(); };
  }, []);

  useEffect(() => {
    let disposed = false;
    let serial = 0;
    let suppress = false;
    let saving = false;
    let pending = false;
    let acknowledged: Partial<ClientUserDataSnapshot> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const controllers = new Set<AbortController>();
    function cancel() {
      serial++;
      clearTimeout(timer); clearTimeout(retry);
      controllers.forEach(controller => controller.abort()); controllers.clear();
      saving = false; pending = false; acknowledged = undefined;
    }
    async function fetchScoped(url: string, init?: RequestInit) {
      const controller = new AbortController(); controllers.add(controller);
      const identity = getWorkspaceIdentity();
      try {
        const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store", headers: { ...init?.headers, "X-PLA-Workspace-Owner": identity.ownerId ?? "guest" } });
        const body = await response.json();
        if (!isWorkspaceCurrent(identity) || disposed) throw new DOMException("Workspace changed", "AbortError");
        return { response, body };
      } finally { controllers.delete(controller); }
    }
    function apply(data: ClientUserDataSnapshot, base = acknowledged) {
      suppress = true;
      try {
        applyClientUserDataSnapshot(data, base);
        acknowledged = (data.revision ?? 0) < getWorkspaceMetadata().revision ? getWorkspaceAcknowledgement() : data;
      }
      finally { suppress = false; }
      window.dispatchEvent(new Event("pla:workspace-loaded"));
    }
    function scheduleSave() {
      if (suppress || !getWorkspaceIdentity().ownerId) return;
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(() => void save(), 900);
    }
    async function save() {
      if (saving || suppress || !getWorkspaceIdentity().ownerId) return;
      const identity = getWorkspaceIdentity(); const run = serial;
      saving = true; pending = false; setStatus("Saving");
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const snapshot = { ...collectClientUserDataSnapshot(), operationId: crypto.randomUUID() };
          const { response, body } = await fetchScoped("/api/user-data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
          if (run !== serial || !isWorkspaceCurrent(identity)) return;
          if (response.status === 409 && body.code === "WORKSPACE_CONFLICT" && body.data) { apply(body.data); continue; }
          if (!response.ok) throw new Error(body.error || "Unable to save workspace.");
          if (body.data) apply(body.data, snapshot);
          else saveWorkspaceMetadata({ ...getWorkspaceMetadata(), revision: body.revision });
          setStatus("Saved"); setDetail(body.data?.conflicts?.length ? "Conflicting versions are preserved in the workspace. Review conflict copies before editing." : ""); return;
        }
        throw new Error("Concurrent edits are still arriving. Local changes are preserved; retry saving.");
      } catch (error) {
        if (run !== serial || !isWorkspaceCurrent(identity) || disposed) return;
        setStatus(navigator.onLine ? "Sync failed" : "Offline");
        setDetail(error instanceof Error ? error.message : "Local changes are preserved.");
        retry = setTimeout(scheduleSave, 5000);
      } finally {
        if (run === serial && !disposed) { saving = false; if (pending) scheduleSave(); }
      }
    }
    async function bootstrap() {
      cancel(); const run = serial;
      // Unmount stale account forms immediately while the cookie/identity is revalidated.
      setReady(false); setEpoch(getWorkspaceIdentity().authEpoch);
      try {
        const { response, body } = await fetchScoped("/api/auth/me");
        if (run !== serial) return;
        if (!response.ok) throw new Error("Unable to verify account.");
        const owner = body.user?.id ?? null;
        const identity = switchWorkspace(owner);
        if (run !== serial) return;
        setEpoch(identity.authEpoch); setDetail("");
        acknowledged = getWorkspaceAcknowledgement();
        if (!owner) { await restoreGuestImageSession(); if(run!==serial)return; setStatus("Local only"); setOfferImport(false); setOfferLegacy(false); return; }
        const remote = await fetchScoped("/api/user-data");
        if (run !== serial) return;
        if (!remote.response.ok) throw new Error(remote.body.error || "Unable to load workspace.");
        apply(remote.body.data);
        const guest = importableData(); const legacy = importableData(true);
        setOfferImport(Boolean((guest.sessions?.length || guest.practiceHistory?.length) && !workspaceStorage().getItem("guest-import-choice")));
        setOfferLegacy(Boolean((legacy.sessions?.length || legacy.practiceHistory?.length) && !workspaceStorage().getItem("legacy-import-choice")));
        setStatus("Saved"); scheduleSave();
      } catch (error) {
        if (run !== serial || disposed) return;
        setStatus(navigator.onLine ? "Sync failed" : "Offline");
        setDetail(error instanceof Error ? error.message : "Unable to load workspace.");
        retry = setTimeout(() => void bootstrap(), 5000);
      } finally {
        if (run === serial && !disposed) { setReady(true); setEpoch(getWorkspaceIdentity().authEpoch); }
      }
    }
    function authChanged() { void bootstrap(); }
    function storageChanged(event: StorageEvent) {
      if (event.key === workspaceIdentityKey) {
        window.dispatchEvent(new Event("pla:workspace-will-change"));
        window.sessionStorage.removeItem("pla.clientProvider.apiKey");
        setEpoch(getWorkspaceIdentity().authEpoch); void bootstrap();
      } else if (event.key?.startsWith(workspaceKey(""))) {
        window.dispatchEvent(new Event("pla:sessions-changed"));
        window.dispatchEvent(new Event("pla:practice-history-changed"));
        window.dispatchEvent(new Event("pla:workspace-loaded"));
        if (workspaceMutationRequiresSync(event.key.slice(workspaceKey("").length), event.oldValue, event.newValue)) scheduleSave();
      }
    }
    function storageFailed(event: Event) { setStatus("Sync failed"); setDetail((event as CustomEvent<string>).detail); }
    function visibilityChanged() { if (document.visibilityState === "hidden") void save(); }
    void bootstrap();
    window.addEventListener("pla:auth-changed", authChanged);
    window.addEventListener("pla:user-data-changed", scheduleSave);
    window.addEventListener("pla:storage-failed", storageFailed);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("online", authChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      disposed = true; cancel();
      window.removeEventListener("pla:auth-changed", authChanged);
      window.removeEventListener("pla:user-data-changed", scheduleSave);
      window.removeEventListener("pla:storage-failed", storageFailed);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("online", authChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  async function chooseImport(importData: boolean, legacy: boolean) {
    if (importController.current) return;
    const controller = new AbortController();
    importController.current = controller;
    setImporting(true);
    const identity=getWorkspaceIdentity();
    try {
    if (importData) {
      const snapshot=await importGuestImages(importableData(legacy), controller.signal);
      if(!isWorkspaceCurrent(identity))return;
      applyClientUserDataSnapshot(snapshot);
    }
    workspaceStorage().setItem(legacy ? "legacy-import-choice" : "guest-import-choice", importData ? "imported" : "separate");
    if (legacy) setOfferLegacy(false); else setOfferImport(false);
    window.dispatchEvent(new Event("pla:workspace-loaded"));
    window.dispatchEvent(new Event("pla:user-data-changed"));
    } catch(error) {if(isWorkspaceCurrent(identity) && !controller.signal.aborted){setStatus("Sync failed");setDetail(error instanceof Error ? error.message : "Import failed. Original records are retained.");}}
    finally { if (importController.current === controller) { importController.current = null; setImporting(false); } }
  }

  return <>
    {ready ? <div className="contents" key={epoch}>{children}</div> : <p role="status" className="p-6 text-sm">Loading workspace…</p>}
    <div className={`fixed bottom-1 right-3 z-50 max-w-[min(92vw,28rem)] bg-white px-2 py-1 text-xs text-zinc-500 ${detail || offerImport || offerLegacy ? "rounded-lg border border-zinc-200 p-3 shadow-sm" : ""}`}>
      <span role="status" aria-live="polite" title={detail}>{status}</span>
      {detail ? <p>{detail} <button className="underline" onClick={() => window.dispatchEvent(new Event("pla:auth-changed"))}>Retry save</button></p> : null}
      {offerImport || offerLegacy ? <div className="mt-2 space-y-2">
        <p>{offerImport ? "Anonymous records are separate from this account." : "Legacy browser records have no verified owner. Import only records that belong to you."}</p>
        <button disabled={importing} className="mr-3 underline disabled:opacity-50" onClick={() => chooseImport(true, !offerImport)}>{importing ? "Importing…" : "Import into this account"}</button>
        <button disabled={importing} className="underline disabled:opacity-50" onClick={() => chooseImport(false, !offerImport)}>Keep separate</button>
      </div> : null}
    </div>
  </>;
}
