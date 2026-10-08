"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Database, FileText, Loader2, LogOut, RefreshCw, Trash2, Upload } from "lucide-react";

import { courseOptions, getCourseLabel } from "@/data/courses";
import { announceAuthChange } from "@/lib/workspace-storage";
import type { CourseId, DetectedLanguage } from "@/types/learning";
import type { PhotoProblemMetadata } from "@/lib/photo-problem";
import { PhotoProblemCapture } from "@/components/knowledge/PhotoProblemCapture";
import { PhotoProblemViewer } from "@/components/knowledge/PhotoProblemViewer";

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
  const visibleDocuments = documents.filter(document => libraryFilter === "all" || document.problem?.kind === libraryFilter);

  const indexedCount = useMemo(
    () => documents.filter((document) => document.indexStatus === "indexed").length,
    [documents],
  );
  const totalChunks = useMemo(
    () => documents.reduce((sum, document) => sum + document.chunkCount, 0),
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

      setNotice(data.document.statusMessage);
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
      setNotice(data.document.statusMessage);
    } catch (reindexError) {
      setError(reindexError instanceof Error ? reindexError.message : "Reindexing failed.");
    } finally {
      setReindexingId("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Personal Knowledge Base
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Add your notes for relevant references in chat.
        </p>
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
                files can be indexed. Scanned pages require OCR before they become searchable.
              </p>
              <p>
                For photos or scanned pages, attach images in Chat. Image uploads are separate from the searchable library.
              </p>
            </div>
          </details>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{user.name}</p>
                  <p className="text-sm text-zinc-500">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950"
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-500">{indexedCount} indexed files · {totalChunks} search chunks</p>
            </section>

            <PhotoProblemCapture onSaved={loadDocuments} />
            <details className="border-t border-zinc-200 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-950">Upload documents</summary>
              <form onSubmit={uploadDocument} className="mt-4 space-y-4">
                <label className="block text-sm">
                  <span className="font-medium text-zinc-800">File</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,.txt,.tex,.csv,.pdf,.docx,.pptx,.xlsx,.rtf,.odt,.odp,.ods"
                    className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:text-white"
                  />
                </label>
                <details className="text-sm text-zinc-600">
                <summary className="cursor-pointer py-1">Course, topic and description</summary>
                <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  <span className="font-medium text-zinc-800">Course</span>
                  <select
                    value={course}
                    onChange={(event) => setCourse(event.target.value as CourseId | "")}
                    className="mt-2 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-500"
                  >
                    <option value="">Detect from the document</option>
                    {courseOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-800">Topic</span>
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-zinc-500"
                    placeholder="Optional chapter or topic"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-800">Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
                    placeholder="Course, chapter, source notes, or usage context"
                  />
                </label>
                </div>
                </details>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white disabled:bg-zinc-400"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {isUploading ? "Uploading..." : "Upload and index"}
                </button>
              </form>
            </details>
          </aside>

          <section className="min-w-0 border-t border-zinc-200 pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <div className="flex flex-col gap-2 border-b border-zinc-200 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">Library</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Indexed files are available to chat retrieval.
                </p>
              </div>
              <select aria-label="Library category" value={libraryFilter} onChange={event => setLibraryFilter(event.target.value as typeof libraryFilter)} className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs">
                <option value="all">All materials</option><option value="exam">Exam photos</option><option value="homework">Homework photos</option>
              </select>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                {notice}
              </p>
            ) : null}

            <div className="mt-5 space-y-3">
              {visibleDocuments.length ? (
                visibleDocuments.map((document) => (
                  <article
                    key={document.id}
                    className="border-b border-zinc-200 pb-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="shrink-0 text-zinc-500" />
                          <h3 className="truncate text-sm font-semibold text-zinc-950">
                            {document.problem?.title ?? document.fileName}
                          </h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                          {document.description || document.statusMessage}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                          {document.problem ? <span>{document.problem.kind === "exam" ? "Exam" : "Homework"} photo</span> : null}
                          <span>
                            {statusLabel(document.indexStatus)}
                          </span>
                          {document.course ? (
                            <span>
                              {getCourseLabel(document.course)}
                            </span>
                          ) : null}
                          {document.topic ? (
                            <span>
                              {document.topic}
                            </span>
                          ) : null}
                          <span>
                            {document.chunkCount} chunks
                          </span>
                          <span>
                            {formatBytes(document.size)}
                          </span>
                          <span>
                            {new Date(document.createdAt).toLocaleDateString("en-US")}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void reindexDocument(document)}
                          disabled={reindexingId === document.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 disabled:text-zinc-400"
                        >
                          <RefreshCw
                            size={15}
                            className={reindexingId === document.id ? "animate-spin" : ""}
                          />
                          Reindex
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDocument(document)}
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-950"
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    </div>
                    {document.problem ? <PhotoProblemViewer document={{ ...document, problem: document.problem }} /> : null}
                    {document.description ? (
                      <p className="mt-3 text-xs leading-5 text-zinc-500">
                        {document.statusMessage}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Database className="mx-auto text-zinc-400" size={28} />
                  <p className="mt-3 text-sm font-medium text-zinc-950">{libraryFilter === "all" ? "No documents yet" : `No ${libraryFilter} photos yet`}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Upload your first note or course document.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
