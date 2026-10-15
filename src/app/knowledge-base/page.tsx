"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Database, FileText, Loader2, LogOut, MoreHorizontal, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";

import { getCourseLabel } from "@/data/courses";
import { announceAuthChange } from "@/lib/workspace-storage";
import type { CourseId, DetectedLanguage } from "@/types/learning";
import type { PhotoProblemMetadata } from "@/lib/photo-problem";
import { PhotoProblemCapture } from "@/components/knowledge/PhotoProblemCapture";
import { PhotoProblemViewer } from "@/components/knowledge/PhotoProblemViewer";
import { DocumentUploadForm } from "@/components/knowledge/DocumentUploadForm";
import { SidePanel } from "@/components/common/SidePanel";
import { Popover } from "@/components/common/Popover";

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
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export default function KnowledgeBasePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<PersonalDocument[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [course, setCourse] = useState<CourseId | "">("");
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [reindexingId, setReindexingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "exam" | "homework">("all");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [materialType, setMaterialType] = useState<"photo" | "document">("photo");
  const visibleDocuments = documents.filter(document => libraryFilter === "all" || document.problem?.kind === libraryFilter);

  const indexedCount = useMemo(
    () => documents.filter((document) => document.indexStatus === "indexed").length,
    [documents],
  );

  async function loadDocuments() {
    const data = await readJson<{ documents: PersonalDocument[] }>(
      await fetch("/api/knowledge/documents", { cache: "no-store" }),
    );
    setDocuments(data.documents);
  }

  useEffect(() => {
    async function boot() {
      try {
        const data = await readJson<{ user: User | null }>(
          await fetch("/api/auth/me", { cache: "no-store" }),
        );
        setUser(data.user);

        if (data.user) {
          await loadDocuments();
        }
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : "Unable to load account state.");
      } finally {
        setIsLoading(false);
      }
    }

    void boot();
  }, []);

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

      setUser(data.user);
      setPassword("");
      setNotice(authMode === "login" ? "Signed in." : "Account created.");
      announceAuthChange(data.user.id);
      await loadDocuments();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    setError("");
    setNotice("");
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setDocuments([]);
    announceAuthChange(null);
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

    const formData = new FormData();
    formData.set("file", file);
    formData.set("description", description);
    formData.set("course", course);
    formData.set("topic", topic);
    setIsUploading(true);

    try {
      const data = await readJson<{ document: PersonalDocument }>(
        await fetch("/api/knowledge/documents", {
          method: "POST",
          body: formData,
        }),
      );

      setDocuments((current) => [data.document, ...current]);
      setDescription("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setNotice(data.document.indexStatus === "indexed" ? "Material saved and ready for chat." : "Material saved. Check File details for its indexing status.");
      setAddingMaterial(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteDocument(document: PersonalDocument) {
    if (!window.confirm(`Delete ${document.fileName}? This removes it from your local library.`)) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await readJson<{ ok: boolean }>(
        await fetch(`/api/knowledge/documents/${encodeURIComponent(document.id)}`, {
          method: "DELETE",
        }),
      );
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setNotice("Document deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    }
  }

  async function reindexDocument(document: PersonalDocument) {
    setError("");
    setNotice("");
    setReindexingId(document.id);

    try {
      const data = await readJson<{ document: PersonalDocument }>(
        await fetch(`/api/knowledge/documents/${encodeURIComponent(document.id)}`, {
          method: "PATCH",
        }),
      );
      setDocuments((current) =>
        current.map((item) => (item.id === document.id ? data.document : item)),
      );
      setNotice(data.document.indexStatus === "indexed" ? "Material is ready for chat." : "Indexing needs attention. Check File details.");
    } catch (reindexError) {
      setError(reindexError instanceof Error ? reindexError.message : "Reindexing failed.");
    } finally {
      setReindexingId("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-8 md:px-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Personal Knowledge Base
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Keep notes and photographed questions together.
        </p>
        </div>
        {user ? <Popover label="Account" trigger={<><UserRound size={16} /><span>Account</span></>} align="end" triggerClassName="flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs text-zinc-600 hover:bg-zinc-100" panelClassName="w-64">
          <p className="text-sm font-medium text-zinc-950">{user.name}</p><p className="mt-1 break-all text-xs text-zinc-500">{user.email}</p>
          <button type="button" onClick={() => void logout()} className="mt-4 flex min-h-9 items-center gap-2 text-xs text-zinc-700" aria-label="Sign out"><LogOut size={15} />Sign out</button>
        </Popover> : null}
      </section>

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center text-sm text-zinc-500">
          <Loader2 className="mr-2 animate-spin" size={16} />
          Loading knowledge base...
        </div>
      ) : !user ? (
        <div className="max-w-sm space-y-5">
          <section>
            <div className="flex rounded-lg border border-zinc-200 p-1 text-sm">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={
                  authMode === "login"
                    ? "flex-1 rounded-md bg-zinc-950 px-3 py-2 text-white"
                    : "flex-1 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50"
                }
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={
                  authMode === "register"
                    ? "flex-1 rounded-md bg-zinc-950 px-3 py-2 text-white"
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-zinc-500"
                  placeholder="At least 8 characters"
                  required
                />
              </label>

              {error ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white disabled:bg-zinc-400"
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select aria-label="Library category" value={libraryFilter} onChange={event => setLibraryFilter(event.target.value as typeof libraryFilter)} className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm">
                <option value="all">All materials</option><option value="exam">Exam photos</option><option value="homework">Homework photos</option>
              </select>
              <span className="text-xs text-zinc-500">{documents.length} {documents.length === 1 ? "material" : "materials"} · {indexedCount} indexed</span>
            </div>
            <button type="button" onClick={() => { setAddingMaterial(true); setError(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white"><Plus size={16} />Add material</button>
          </div>
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
                  <Popover label={`Actions for ${document.problem?.title ?? document.fileName}`} trigger={<MoreHorizontal size={18} />} align="end" closeOnAction triggerClassName="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100" panelClassName="w-40">
                    <button type="button" onClick={() => void reindexDocument(document)} disabled={reindexingId === document.id} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs hover:bg-zinc-100 disabled:text-zinc-400"><RefreshCw size={14} className={reindexingId === document.id ? "animate-spin" : ""} />Reindex</button>
                    <button type="button" onClick={() => void deleteDocument(document)} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-red-700 hover:bg-zinc-50"><Trash2 size={14} />Delete</button>
                  </Popover>
                </div>
                {reindexingId === document.id ? <p role="status" className="mt-2 text-xs text-zinc-500">Updating index…</p> : null}
                {document.problem ? <PhotoProblemViewer document={{ ...document, problem: document.problem }} /> : null}
                <details className="mt-2 text-xs text-zinc-500">
                  <summary className="w-fit cursor-pointer py-1">File details</summary>
                  <div className="mt-2 space-y-1 leading-5"><p>{document.fileName} · {formatBytes(document.size)} · {document.chunkCount} chunks</p><p>{new Date(document.createdAt).toLocaleDateString("en-US")}</p>{document.description ? <p>{document.description}</p> : null}<p>{document.statusMessage}</p></div>
                </details>
              </article>
            )) : <div className="py-16 text-center">
              <Database className="mx-auto text-zinc-400" size={24} />
              <h2 className="mt-4 text-sm font-medium text-zinc-950">{libraryFilter === "all" ? "No materials yet" : `No ${libraryFilter} photos yet`}</h2>
              <p className="mt-2 text-sm text-zinc-500">Use Add material to save notes or photographed questions.</p>
            </div>}
          </div>
          {addingMaterial ? <SidePanel title="Add material" onClose={() => setAddingMaterial(false)}>
            <fieldset className="mb-5"><legend className="sr-only">Material type</legend><div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
              {([['photo', 'Photo problems'], ['document', 'Document']] as const).map(([value, label]) => <label key={value} className="cursor-pointer"><input type="radio" name="material-type" value={value} checked={materialType === value} onChange={() => setMaterialType(value)} disabled={isUploading} className="peer sr-only" /><span className="block rounded-lg px-3 py-2 text-center text-sm text-zinc-500 peer-checked:bg-white peer-checked:font-medium peer-checked:text-zinc-950 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-500">{label}</span></label>)}
            </div></fieldset>
            {materialType === "photo" ? <PhotoProblemCapture embedded onSaved={loadDocuments} onComplete={() => { setAddingMaterial(false); setNotice("Photo problem saved to your library."); }} /> : <DocumentUploadForm inputRef={fileInputRef} onSubmit={uploadDocument} busy={isUploading} course={course} onCourseChange={setCourse} topic={topic} onTopicChange={setTopic} description={description} onDescriptionChange={setDescription} />}
            {error && materialType === "document" ? <p role="alert" className="mt-4 text-sm leading-6 text-red-700">{error}</p> : null}
          </SidePanel> : null}
        </section>
      )}
    </div>
  );
}
