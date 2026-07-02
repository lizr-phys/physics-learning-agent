"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Settings, XCircle } from "lucide-react";

import {
  clearLastApiError,
  getLastApiError,
  saveLastApiError,
  type StoredApiError,
} from "@/lib/api-diagnostics";
import { resetOnboarding } from "@/lib/preferences";

type ApiStatus = {
  ok: boolean;
  status: string;
  message: string;
  config: {
    configured: boolean;
    baseUrl: string;
    model: string;
    thinkingMode: string;
    timeoutMs: number;
    streaming: boolean;
  };
};

const modelOptions = [
  { id: "deepseek-v4-flash", label: "deepseek-v4-flash" },
  { id: "deepseek-v4-pro", label: "deepseek-v4-pro" },
  { id: "deepseek-chat", label: "deepseek-chat (compatible alias)" },
  { id: "deepseek-reasoner", label: "deepseek-reasoner (compatible alias)" },
];

async function fetchApiStatus(mode: "status" | "test") {
  const response = await fetch(`/api/deepseek/test${mode === "status" ? "?mode=status" : ""}`, {
    cache: "no-store",
  });
  return (await response.json()) as ApiStatus;
}

export default function ApiSettingsPage() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState("deepseek-v4-flash");
  const [isTesting, setIsTesting] = useState(false);
  const [lastError, setLastError] = useState<StoredApiError | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedModel(window.localStorage.getItem("pla.deepseek.model") ?? "deepseek-v4-flash");
      setLastError(getLastApiError());
    }, 0);

    fetchApiStatus("status").then(setStatus).catch(() => {
      setStatus({
        ok: false,
        status: "request-failed",
        message: "Unable to read API configuration status.",
        config: {
          configured: false,
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-v4-flash",
          thinkingMode: "disabled",
          timeoutMs: 120000,
          streaming: true,
        },
      });
    });

    return () => window.clearTimeout(timer);
  }, []);

  function handleModelChange(model: string) {
    setSelectedModel(model);
    window.localStorage.setItem("pla.deepseek.model", model);
  }

  async function testConnection() {
    setIsTesting(true);

    try {
      const nextStatus = await fetchApiStatus("test");
      setStatus(nextStatus);

      if (nextStatus.ok) {
        clearLastApiError();
        setLastError(null);
      } else {
        const nextError = {
          message: nextStatus.message,
          status: nextStatus.status,
          occurredAt: Date.now(),
        };
        saveLastApiError(nextError);
        setLastError(nextError);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection test failed.";
      const nextError = {
        message,
        status: "request-failed",
        occurredAt: Date.now(),
      };
      saveLastApiError(nextError);
      setLastError(nextError);
      setStatus((current) => ({
        ok: false,
        status: "request-failed",
        message,
        config:
          current?.config ?? {
            configured: false,
            baseUrl: "https://api.deepseek.com",
            model: "deepseek-v4-flash",
            thinkingMode: "disabled",
            timeoutMs: 120000,
            streaming: true,
          },
      }));
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <section className="border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
          <Settings size={16} />
          API Settings
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          DeepSeek API Status
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          The API key is read only from server-side environment variables. This page shows configuration status, local model preference, and a server-side connection test.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Current Status</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {status?.ok ? (
                <CheckCircle2 size={16} className="text-zinc-950" />
              ) : (
                <XCircle size={16} className="text-zinc-500" />
              )}
              <span>DeepSeek API: {status?.config.configured ? "configured" : "not configured"}</span>
            </div>
            <p className="text-zinc-600">Server model: {status?.config.model ?? "Loading..."}</p>
            <p className="text-zinc-600">Browser model preference: {selectedModel}</p>
            <p className="text-zinc-600">Base URL: {status?.config.baseUrl ?? "Loading..."}</p>
            <p className="text-zinc-600">
              Response mode: {status?.config.streaming ? "streaming" : "non-streaming"}
            </p>
            <p className="text-zinc-600">Thinking: {status?.config.thinkingMode ?? "Loading..."}</p>
            <p className="text-zinc-600">Timeout: {status?.config.timeoutMs ?? 120000} ms</p>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 p-4 text-sm">
            <p className="font-medium text-zinc-950">Last API Error</p>
            {lastError ? (
              <>
                <p className="mt-2 leading-6 text-zinc-700">{lastError.message}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {lastError.status ?? "unknown"} ·{" "}
                  {new Date(lastError.occurredAt).toLocaleString("en-US")}
                </p>
              </>
            ) : (
              <p className="mt-2 text-zinc-500">No API error is stored in this browser.</p>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p className="font-medium text-zinc-950">Connection Test Result</p>
            <p className="mt-2 leading-6">{status?.message ?? "Reading configuration status..."}</p>
            <p className="mt-1 text-xs text-zinc-500">Status: {status?.status ?? "loading"}</p>
          </div>

          <button
            type="button"
            onClick={testConnection}
            disabled={isTesting}
            className="mt-5 flex h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white disabled:bg-zinc-400"
          >
            {isTesting ? <Loader2 size={16} className="animate-spin" /> : null}
            {isTesting ? "Testing..." : "Test connection"}
          </button>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">Model Preference</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The selection is stored in this browser&apos;s localStorage. Requests still go through the server and never expose the API key.
            </p>
            <select
              value={selectedModel}
              onChange={(event) => handleModelChange(event.target.value)}
              className="mt-4 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500"
            >
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">.env.local</h2>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700">
{`DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=120000`}
            </pre>
            {!status?.config.configured ? (
              <p className="mt-3 text-xs leading-5 text-zinc-600">
                Configure DEEPSEEK_API_KEY in `.env.local`, then restart the development server.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">First-Use Guide</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Reopen the short onboarding note shown on first use.
            </p>
            <button
              type="button"
              onClick={() => {
                resetOnboarding();
                window.location.assign("/chat");
              }}
              className="mt-3 rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Show guide again
            </button>
          </section>

          <section id="rag" className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">RAG Notes</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The current prototype uses local Markdown samples in `src/rag/sample-docs` with simple keyword retrieval. It can later be extended to user-owned PDFs, lecture notes, embeddings, and a vector store.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
