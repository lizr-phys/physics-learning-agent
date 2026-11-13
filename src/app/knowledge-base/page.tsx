"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Database, FileText, Loader2, LogOut, MoreHorizontal, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";

import { getCourseLabel } from "@/data/courses";
import { announceAuthChange, getWorkspaceIdentity, isWorkspaceCurrent } from "@/lib/workspace-storage";
import type { CourseId, DetectedLanguage } from "@/types/learning";
import type { PhotoProblemMetadata } from "@/lib/photo-problem";
import { PhotoProblemViewer } from "@/components/knowledge/PhotoProblemViewer";
import { DocumentUploadForm } from "@/components/knowledge/DocumentUploadForm";
import { SidePanel } from "@/components/common/SidePanel";
import { Popover } from "@/components/common/Popover";
import { useWorkspaceAccount } from "@/components/layout/UserDataSync";
import { WorkspaceHeading } from "@/components/layout/WorkspaceHeading";

const PhotoProblemCapture = dynamic(() => import("@/components/knowledge/PhotoProblemCapture").then(module => module.PhotoProblemCapture), {
  loading: () => <p role="status" className="py-3 text-sm text-zinc-600">Loading photo tools…</p>,
});

type User = {
  id: string;
  email: string;
  name: string;
  createdAt: number;
};

type PersonalDocument = {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  size: number;
  description?: string;
  course?: CourseId;
  topic?: string;
  language?: DetectedLanguage;
  sourceType?: string;
  extractionMethod?: "langchain-text" | "officeparser-structure";
  indexStatus: "indexed" | "stored-only" | "failed";
  statusMessage: string;
  chunkCount: number;
  indexedAt?: number;
  createdAt: number;
  problem?: PhotoProblemMetadata;
};

type AuthMode = "login" | "register";

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: PersonalDocument["indexStatus"]) {
  switch (status) {
    case "indexed":
      return "Indexed";
    case "stored-only":
      return "Stored only";
    case "failed":
      return "Needs attention";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;

  if (!response.ok || !data) {
    throw new Error(data?.error || `Request failed (HTTP ${response.status}). Try again.`);
  }

  return data;
}

export default function KnowledgeBasePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const operations = useRef(new Set<AbortController>());
  const documentLoad = useRef<AbortController | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const user = useWorkspaceAccount();
  const userId = user?.id;
  const [documents, setDocuments] = useState<PersonalDocument[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [course, setCourse] = useState<CourseId | "">("");
  const [topic, setTopic] = useState("");
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [loadingError, setLoadingError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [reindexingId, setReindexingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "exam" | "homework">("all");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [materialType, setMaterialType] = useState<"photo" | "document">("photo");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const visibleDocuments = useMemo(() => {
    const terms = deferredQuery.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return documents.filter(document => {
      if (libraryFilter !== "all" && document.problem?.kind !== libraryFilter) return false;
      const text = [document.fileName, document.problem?.title, document.description, document.topic, document.course && getCourseLabel(document.course)]
        .filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    });
  }, [documents, deferredQuery, libraryFilter]);

  const indexedCount = useMemo(
    () => documents.filter((document) => document.indexStatus === "indexed").length,
    [documents],
  );

  const loadDocuments = useCallback(async () => {
    const identity = getWorkspaceIdentity();
    if (!userId || identity.ownerId !== userId) return;
    documentLoad.current?.abort();
    const controller = new AbortController();
    documentLoad.current = controller;
    operations.current.add(controller);
    try {
      const data = await readJson<{ documents: PersonalDocument[] }>(
        await fetch("/api/knowledge/documents", { cache: "no-store", signal: controller.signal, headers: { "X-PLA-Workspace-Owner": userId } }),
      );
      if (controller.signal.aborted || !isWorkspaceCurrent(identity)) return;
      setDocuments(data.documents.filter(document => document.userId === userId));
      setLoadingError("");
    } catch (error) {
      if (!controller.signal.aborted && isWorkspaceCurrent(identity)) setLoadingError(error instanceof Error ? error.message : "Unable to load your materials.");
    } finally {
      operations.current.delete(controller);
      if (documentLoad.current === controller) {
        documentLoad.current = null;
        if (!controller.signal.aborted && isWorkspaceCurrent(identity)) {
          setDocumentsLoaded(true);
          setReloading(false);
        }
      }
    }
  }, [userId]);

  useEffect(() => {
    const active = operations.current;
    const cancel = () => { for (const controller of active) controller.abort(); active.clear(); };
    const start = window.setTimeout(() => void loadDocuments(), 0);
    window.addEventListener("pla:workspace-will-change", cancel);
    return () => {
      window.clearTimeout(start);
      cancel();
      window.removeEventListener("pla:workspace-will-change", cancel);
    };
  }, [loadDocuments]);

  async function mutateLibrary<T>(path: string, init: RequestInit, apply: (data: T) => void) {
    const identity = getWorkspaceIdentity();
    if (!userId || identity.ownerId !== userId) return;
    const controller = new AbortController();
    operations.current.add(controller);
    try {
      const result = await readJson<T>(await fetch(path, { ...init, signal: controller.signal, headers: { "X-PLA-Workspace-Owner": userId } }));
      if (!controller.signal.aborted && isWorkspaceCurrent(identity)) apply(result);
    } catch (error) {
      if (!controller.signal.aborted && isWorkspaceCurrent(identity)) throw error;
    } finally { operations.current.delete(controller); }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await readJson<{ user: User }>(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        }),
      );

      setPassword("");
      announceAuthChange(data.user.id);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    const identity = getWorkspaceIdentity();
    if (signingOut || !userId || identity.ownerId !== userId) return;
    setError("");
    setNotice("");
    setSigningOut(true);
    try {
      const response = await readJson<{ ok: boolean }>(await fetch("/api/auth/logout", { method: "POST", headers: { "X-PLA-Workspace-Owner": userId } }));
      if (!response.ok) throw new Error("Unable to sign out. Try again.");
      if (isWorkspaceCurrent(identity)) announceAuthChange(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign out. Try again.");
    } finally { setSigningOut(false); }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Choose a file first.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Choose a document up to 12 MB.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("description", description);
    formData.set("course", course);
    formData.set("topic", topic);
    setIsUploading(true);

    try {
      await mutateLibrary<{ document: PersonalDocument }>("/api/knowledge/documents", { method: "POST", body: formData }, ({ document }) => {
        setDocuments(current => [document, ...current.filter(item => item.id !== document.id)]);
        setDescription("");
        setTopic("");
        setCourse("");
        setQuery("");
        setLibraryFilter("all");
        setNotice(document.indexStatus === "indexed" ? "Material saved and ready for chat." : "Material saved. Check File details for its indexing status.");
        setAddingMaterial(false);
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteDocument(document: PersonalDocument) {
    if (deletingId) return;
    if (!window.confirm(`Delete ${document.fileName}? This removes it from your local library.`)) {
      return;
    }

    setError("");
    setNotice("");
    setDeletingId(document.id);

    try {
      await mutateLibrary<{ ok: boolean }>(`/api/knowledge/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" }, () => {
        setDocuments(current => current.filter(item => item.id !== document.id));
        setNotice("Document deleted.");
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally { setDeletingId(""); }
  }

  async function reindexDocument(document: PersonalDocument) {
    if (reindexingId) return;
    setError("");
    setNotice("");
    setReindexingId(document.id);

    try {
      await mutateLibrary<{ document: PersonalDocument }>(`/api/knowledge/documents/${encodeURIComponent(document.id)}`, { method: "PATCH" }, ({ document: updated }) => {
        setDocuments(current => current.map(item => item.id === updated.id ? updated : item));
        setNotice(updated.indexStatus === "indexed" ? "Material is ready for chat." : "Indexing needs attention. Check File details.");
      });
    } catch (reindexError) {
      setError(reindexError instanceof Error ? reindexError.message : "Reindexing failed.");
    } finally {
      setReindexingId("");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <WorkspaceHeading title="Personal Knowledge Base" description="Save notes and photographed problems, then use them as sources in chat." />
        {user ? <Popover label="Account" trigger={<><UserRound size={16} /><span>Account</span></>} align="end" triggerClassName="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-zinc-700 hover:bg-zinc-100" panelClassName="w-64">
          <p className="text-sm font-medium text-zinc-950">{user.name}</p><p className="mt-1 break-all text-xs text-zinc-500">{user.email}</p>
          <button type="button" disabled={signingOut} onClick={() => void logout()} className="mt-3 flex min-h-11 items-center gap-2 text-sm text-zinc-700 disabled:opacity-50" aria-label="Sign out"><LogOut size={15} />{signingOut ? "Signing out…" : "Sign out"}</button>
        </Popover> : null}
      </div>

      {user === undefined ? (
        <p role="status" className="text-sm text-zinc-600">Your account could not be verified. Retry the connection below.</p>
      ) : !user ? (
        <div className="max-w-sm space-y-5">
          <section>
            <div className="flex rounded-lg border border-zinc-200 p-1 text-sm">
              <button
                type="button"
                aria-pressed={authMode === "login"}
                onClick={() => setAuthMode("login")}
                className={
                  authMode === "login"
                    ? "min-h-11 flex-1 rounded-md bg-study-800 px-3 py-2 text-white"
                    : "flex-1 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50"
                }
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={authMode === "register"}
                onClick={() => setAuthMode("register")}
                className={
                  authMode === "register"
                    ? "min-h-11 flex-1 rounded-md bg-study-800 px-3 py-2 text-white"
                    : "flex-1 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50"
                }
              >
                Create account
              </button>
            </div>

            <form onSubmit={submitAuth} className="mt-5 space-y-4">
              {authMode === "register" ? (
                <label className="block text-sm">
                  <span className="font-medium text-zinc-800">Name</span>
                  <input
                    value={name}
                    autoComplete="name"
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-zinc-500"
                    placeholder="Ada Lovelace"
                  />
                </label>
              ) : null}

              <label className="block text-sm">
                <span className="font-medium text-zinc-800">Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-zinc-500"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium text-zinc-800">Password</span>
                <input
                  type="password"
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  minLength={authMode === "register" ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-zinc-500"
                  placeholder="At least 8 characters"
                  required
                />
              </label>

              {error ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="study-primary w-full"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {authMode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </section>

          <details className="border-t border-zinc-200 pt-4">
            <summary className="cursor-pointer text-sm text-zinc-600">Supported files and privacy</summary>
            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
              <p>
                Files stay with your account. Matching excerpts are sent to the selected model when you use personal retrieval.
              </p>
              <p>
                Markdown, TXT, TeX, CSV, text-based PDF, DOCX, PPTX, XLSX, RTF, and OpenDocument
                files can be indexed.
              </p>
              <p>
                For exam or homework photos, use Add material after signing in. Review the recognized text before saving it to your searchable library.
              </p>
            </div>
          </details>
        </div>
      ) : (
        <section className="space-y-5 pb-10" aria-label="Saved materials">
          <div className="flex flex-wrap items-center gap-3">
              <label className="min-w-40 flex-1">
                <span className="sr-only">Search materials</span>
                <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search materials"
                  className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm" />
              </label>
              <select aria-label="Library category" value={libraryFilter} onChange={event => setLibraryFilter(event.target.value as typeof libraryFilter)} className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm">
                <option value="all">All materials</option><option value="exam">Exam photos</option><option value="homework">Homework photos</option>
              </select>
            <button type="button" disabled={!documentsLoaded || reloading} onClick={() => { setAddingMaterial(true); setError(""); }} className="study-primary"><Plus size={16} />Add material</button>
          </div>
          <p role="status" className="flex items-center gap-2 text-sm text-zinc-600">
            {!documentsLoaded || reloading ? <><Loader2 size={16} className="animate-spin" />Loading your materials…</>
              : loadingError && !documents.length ? "Materials unavailable"
              : query.trim() || libraryFilter !== "all" ? `${visibleDocuments.length} of ${documents.length} materials`
              : `${documents.length} ${documents.length === 1 ? "material" : "materials"} · ${indexedCount} indexed`}
          </p>
          {loadingError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p role="alert">{loadingError}</p>
            <button type="button" disabled={reloading} onClick={() => { setReloading(true); void loadDocuments(); }} className="min-h-10 font-medium underline underline-offset-2 disabled:opacity-50">Retry loading materials</button>
          </div> : null}
          {isUploading ? <p role="status" className="text-xs text-zinc-500">Uploading material…</p> : null}
          {error ? <p role="alert" className="text-sm leading-6 text-red-700">{error}</p> : null}
          {notice ? <p role="status" className="text-xs leading-5 text-zinc-600">{notice}</p> : null}
          <div className="divide-y divide-zinc-200 border-t border-zinc-200">
            {visibleDocuments.length ? visibleDocuments.map(document => (
              <article key={document.id} className="py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="shrink-0 text-zinc-500" />
                      <h3 className="truncate text-sm font-medium text-zinc-950">{document.problem?.title ?? document.fileName}</h3>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{document.problem ? `${document.problem.kind === "exam" ? "Exam" : "Homework"} photo · ` : ""}{statusLabel(document.indexStatus)}{document.course ? ` · ${getCourseLabel(document.course)}` : ""}{document.topic ? ` · ${document.topic}` : ""}</p>
                  </div>
                  <Popover label={`Actions for ${document.problem?.title ?? document.fileName}`} trigger={<MoreHorizontal size={18} />} align="end" closeOnAction triggerClassName="flex size-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100" panelClassName="w-40">
                    <button type="button" onClick={() => void reindexDocument(document)} disabled={Boolean(reloading || reindexingId || deletingId)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-zinc-100 disabled:text-zinc-400"><RefreshCw size={14} />Reindex</button>
                    <button type="button" onClick={() => void deleteDocument(document)} disabled={Boolean(reloading || reindexingId || deletingId)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} />Delete</button>
                  </Popover>
                </div>
                {reindexingId === document.id ? <p role="status" className="mt-2 text-xs text-zinc-500">Updating index…</p> : null}
                {document.problem ? <PhotoProblemViewer document={{ ...document, problem: document.problem }} /> : null}
                <details className="mt-2 text-xs text-zinc-500">
                  <summary className="w-fit cursor-pointer py-1">File details</summary>
                  <div className="mt-2 space-y-1 leading-5"><p>{document.fileName} · {formatBytes(document.size)} · {document.chunkCount} chunks</p><p>{new Date(document.createdAt).toLocaleDateString("en-US")}</p>{document.description ? <p>{document.description}</p> : null}<p>{document.statusMessage}</p></div>
                </details>
              </article>
            )) : !documentsLoaded || reloading || loadingError ? null : <div className="py-12 text-center">
              <Database className="mx-auto text-zinc-400" size={24} />
              <h2 className="mt-4 text-base font-medium text-zinc-950">{query.trim() ? "No matching materials" : libraryFilter === "all" ? "No materials yet" : `No ${libraryFilter} photos yet`}</h2>
              {query.trim() || libraryFilter !== "all" ? <button type="button" onClick={() => { setQuery(""); setLibraryFilter("all"); }} className="min-h-11 text-sm text-study-800 underline underline-offset-2">Clear filters</button>
                : <p className="mt-2 text-sm text-zinc-600">Use Add material to save notes or photographed questions.</p>}
            </div>}
          </div>
          {addingMaterial ? <SidePanel title="Add material" onClose={() => setAddingMaterial(false)} busy={isUploading}>
            <fieldset className="mb-5"><legend className="sr-only">Material type</legend><div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
              {([['photo', 'Photo problems'], ['document', 'Document']] as const).map(([value, label]) => <label key={value} className="cursor-pointer"><input type="radio" name="material-type" value={value} checked={materialType === value} onChange={() => setMaterialType(value)} disabled={isUploading} className="peer sr-only" /><span className="block rounded-lg px-3 py-2 text-center text-sm text-zinc-500 peer-checked:bg-white peer-checked:font-medium peer-checked:text-zinc-950 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-500">{label}</span></label>)}
            </div></fieldset>
            {materialType === "photo" ? <PhotoProblemCapture embedded onSaved={loadDocuments} onComplete={() => { setAddingMaterial(false); setQuery(""); setLibraryFilter("all"); setNotice("Photo problem saved to your library."); }} /> : <DocumentUploadForm inputRef={fileInputRef} onSubmit={uploadDocument} busy={isUploading} course={course} onCourseChange={setCourse} topic={topic} onTopicChange={setTopic} description={description} onDescriptionChange={setDescription} />}
            {error && materialType === "document" ? <p role="alert" className="mt-4 text-sm leading-6 text-red-700">{error}</p> : null}
          </SidePanel> : null}
        </section>
      )}
    </div>
  );
}
