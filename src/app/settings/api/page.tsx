"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { WorkspaceHeading } from "@/components/layout/WorkspaceHeading";
import { clearLastApiError, getLastApiError, saveLastApiError } from "@/lib/api-diagnostics";
import {
  buildClientProviderDraft,
  clearClientProviderSessionKey,
  clientProviderPresets,
  getClientProviderPreset,
  getClientProviderPublicConfig,
  getClientProviderSessionKey,
  getStoredServerModel,
  saveClientProviderPublicConfig,
  saveClientProviderSessionKey,
} from "@/lib/client-provider";
import { resetOnboarding } from "@/lib/preferences";
import { serverModelOptions } from "@/lib/server-models";
import { workspaceStorage } from "@/lib/workspace-storage";
import type { ClientProviderId } from "@/types/learning";

const WorkspaceDataTools = dynamic(() => import("@/components/layout/WorkspaceDataTools").then(module => module.WorkspaceDataTools), {
  loading: () => <p role="status">Loading workspace tools…</p>,
});

type ApiStatus = {
  ok: boolean;
  status: string;
  message: string;
  config?: { configured: boolean; baseUrl: string; model: string; timeoutMs: number };
};

type Connection = "server" | "personal";
type ProviderFields = { provider: ClientProviderId; baseUrl: string; model: string; apiKey: string };
const fieldClass = "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950";
const secondaryAction = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50";
const invalidDraft = "Enter a model, an API key for this endpoint, and a valid Base URL if required.";

async function readStatus(url: string, init?: RequestInit): Promise<ApiStatus> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const status = await response.json().catch(() => null) as ApiStatus | null;
  if (!status || typeof status.ok !== "boolean" || typeof status.message !== "string") {
    throw new Error(`Could not read the connection status (HTTP ${response.status}). Try again.`);
  }
  return status;
}

export default function ApiSettingsPage() {
  const router = useRouter();
  const [saved, setSaved] = useState(getClientProviderPublicConfig);
  const [connection, setConnection] = useState<Connection>(() => saved.enabled ? "personal" : "server");
  const [savedServerModel, setSavedServerModel] = useState(() => getStoredServerModel() ?? "");
  const [serverModel, setServerModel] = useState(savedServerModel);
  const [fields, setFields] = useState<ProviderFields>(() => ({
    provider: saved.provider, baseUrl: saved.baseUrl, model: saved.model, apiKey: "",
  }));
  const [serverStatus, setServerStatus] = useState<ApiStatus>();
  const [testStatus, setTestStatus] = useState<Partial<Record<Connection, ApiStatus>>>({});
  const [testing, setTesting] = useState<Connection>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [lastError, setLastError] = useState(getLastApiError);
  const testController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void readStatus("/api/deepseek/test?mode=status", { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setServerStatus(result); })
      .catch(() => { if (!controller.signal.aborted) setServerStatus({ ok: false, status: "request-failed", message: "Unable to read server configuration. You can still test the connection." }); });
    const abortTests = () => testController.current?.abort();
    window.addEventListener("pla:workspace-will-change", abortTests);
    return () => {
      controller.abort();
      abortTests();
      window.removeEventListener("pla:workspace-will-change", abortTests);
    };
  }, []);

  const preset = getClientProviderPreset(fields.provider);
  const testResult = testStatus[connection];
  const savedKeyAvailable = Boolean(getClientProviderSessionKey(fields));
  const serverDisplayModel = serverModel || serverStatus?.config?.model || "Configured server model";

  function cancelTest() {
    testController.current?.abort();
    testController.current = null;
    setTesting(undefined);
  }

  function changeFields(values: Partial<ProviderFields>) {
    cancelTest();
    setFields(current => ({ ...current, ...values }));
    setTestStatus(current => ({ ...current, personal: undefined }));
    setNotice("");
    setError("");
  }

  function changeProvider(provider: ClientProviderId) {
    const next = getClientProviderPreset(provider);
    changeFields({ provider, baseUrl: next.defaultBaseUrl ?? "", model: next.defaultModel, apiKey: "" });
  }

  function selectConnection(next: Connection) {
    cancelTest();
    setConnection(next);
    setNotice("");
    setError("");
  }

  function saveConnection() {
    setError("");
    setNotice("");
    try {
      if (connection === "server") {
        if (serverModel) workspaceStorage().setItem("pla.deepseek.model", serverModel);
        else workspaceStorage().removeItem("pla.deepseek.model");
        saveClientProviderPublicConfig({ ...saved, enabled: false });
        setSavedServerModel(serverModel);
        setNotice("Server connection selected.");
      } else {
        const config = buildClientProviderDraft(fields);
        if (!config) { setError(invalidDraft); return; }
        saveClientProviderPublicConfig({ ...config, enabled: true });
        saveClientProviderSessionKey(config.apiKey, fields);
        setFields(current => ({ ...current, apiKey: "" }));
        setNotice("Connection saved for this browser.");
      }
      setSaved(getClientProviderPublicConfig());
    } catch {
      setError("The browser could not save the connection. Check available storage and try again.");
    }
  }

  async function testConnection() {
    if (testController.current) return;
    setError("");
    setNotice("");
    const draft = connection === "personal" ? buildClientProviderDraft(fields) : undefined;
    if (connection === "personal" && !draft) { setError(invalidDraft); return; }

    const controller = new AbortController();
    testController.current = controller;
    setTesting(connection);
    setTestStatus(current => ({ ...current, [connection]: undefined }));
    try {
      const params = new URLSearchParams(serverModel ? { model: serverModel } : {});
      const result = draft
        ? await readStatus("/api/deepseek/test", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ clientProvider: draft }),
        })
        : await readStatus(serverModel ? `/api/deepseek/test?${params}` : "/api/deepseek/test", { signal: controller.signal });
      if (controller.signal.aborted) return;
      setTestStatus(current => ({ ...current, [connection]: result }));
      if (!result.ok) {
        const diagnostic = { message: result.message, status: result.status, source: "settings" as const, occurredAt: Date.now() };
        try { saveLastApiError(diagnostic); } catch { /* The test result remains visible. */ }
        setLastError(diagnostic);
      } else if (lastError?.source === "settings") {
        clearLastApiError();
        setLastError(null);
      }
    } catch {
      if (!controller.signal.aborted) setError("Connection test could not be completed. Check your network and try again.");
    } finally {
      if (testController.current === controller) { testController.current = null; setTesting(undefined); }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7 px-5 py-8 md:px-8">
      <WorkspaceHeading title="API Settings" description="Connect the model you use for chat, practice and photo recognition." />
      <p className="flex items-start gap-2 text-sm text-zinc-600">
        <span className="font-medium text-zinc-950">In use:</span>
        <span className="min-w-0 break-words">{saved.enabled
          ? `${saved.label} · ${saved.model}${saved.hasSessionKey ? "" : " · key needed in this tab"}`
          : savedServerModel || serverStatus?.config?.model || "Server default"}</span>
      </p>
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-zinc-800">Connection</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
          {([{ value: "server", label: "Server default" }, { value: "personal", label: "My API key" }] as const).map(option => (
            <label key={option.value} className="cursor-pointer">
              <input type="radio" name="connection-source" checked={connection === option.value} onChange={() => selectConnection(option.value)} className="peer sr-only" />
              <span className="block rounded-lg px-3 py-2.5 text-center text-sm text-zinc-600 peer-checked:bg-white peer-checked:font-medium peer-checked:text-study-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-study-700">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {connection === "personal" ? (
        <section className="space-y-4" aria-label="Bring Your Own Key">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block min-w-0 space-y-2 text-sm text-zinc-700">Provider
              <select value={fields.provider} onChange={event => changeProvider(event.target.value as ClientProviderId)} className={fieldClass}>
                {clientProviderPresets.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
              </select>
            </label>
            <label className="block min-w-0 space-y-2 text-sm text-zinc-700">Model
              <input value={fields.model} onChange={event => changeFields({ model: event.target.value })} placeholder={preset.defaultModel || "model-name"} maxLength={160} className={fieldClass} />
            </label>
          </div>
          <label className="block space-y-2 text-sm text-zinc-700">API Key
            <input type="password" autoComplete="off" value={fields.apiKey} onChange={event => changeFields({ apiKey: event.target.value })} placeholder={savedKeyAvailable ? "A key is saved for this tab" : "Paste your provider key"} maxLength={600} className={fieldClass} />
          </label>
          <p className="text-xs leading-5 text-zinc-600">Your key stays in this tab. Use a model that supports images for photo questions.</p>
          <details className="text-sm text-zinc-600">
            <summary className="cursor-pointer py-1">Connection details</summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs leading-5">{preset.description}</p>
              {preset.baseUrlEditable ? (
                <label className="block space-y-2">Base URL
                  <input type="url" value={fields.baseUrl} onChange={event => changeFields({ baseUrl: event.target.value })} placeholder="https://api.example.com/v1" maxLength={400} className={fieldClass} />
                </label>
              ) : <p>This provider uses its native API endpoint.</p>}
              {saved.hasSessionKey ? <button type="button" onClick={() => {
                clearClientProviderSessionKey();
                changeFields({ apiKey: "" });
                setSaved(getClientProviderPublicConfig());
                setNotice("Session key cleared.");
              }} className="min-h-11 underline underline-offset-2">Clear session key</button> : null}
            </div>
          </details>
        </section>
      ) : (
        <section className="space-y-3" aria-label="Server Default Provider">
          <label className="block space-y-2 text-sm text-zinc-700">Model
            <select aria-label="Server model preference" value={serverModel} onChange={event => {
              cancelTest();
              setServerModel(event.target.value);
              setTestStatus(current => ({ ...current, server: undefined }));
              setError("");
              setNotice("");
            }} className={fieldClass}>
              <option value="">Server model{serverStatus?.config?.model ? ` · ${serverStatus.config.model}` : ""}</option>
              {serverModelOptions.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </label>
          {serverStatus && !testResult ? <p role="status" className="text-sm leading-6 text-zinc-600">{serverStatus.message}</p> : null}
        </section>
      )}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={saveConnection} className="study-primary">
            {connection === "personal" ? "Save for this browser" : "Use server connection"}
          </button>
          <button type="button" onClick={() => void testConnection()} disabled={Boolean(testing)} className={secondaryAction}>
            {testing ? <Loader2 size={14} className="animate-spin" /> : null}
            {testing ? "Testing…" : connection === "personal" ? "Test provider" : "Test connection"}
          </button>
        </div>
        {error ? <p role="alert" className="break-words text-sm text-red-800">{error}</p> : null}
        {notice ? <p role="status" className="flex items-center gap-2 text-sm text-study-800"><Check size={16} />{notice}</p> : null}
        {testResult ? <p role={testResult.ok ? "status" : "alert"} className={`break-words text-sm leading-6 ${testResult.ok ? "text-study-800" : "text-red-800"}`}>{testResult.message}</p> : null}
      </div>
      <details onToggle={event => setAdvancedOpen(event.currentTarget.open)} className="border-t border-zinc-200 pt-5 text-sm text-zinc-600">
        <summary className="cursor-pointer font-medium">Advanced</summary>
        {advancedOpen ? <div className="mt-5 space-y-5">
          <details className="text-xs">
            <summary className="cursor-pointer py-1">Diagnostics</summary>
            <div className="mt-3 space-y-2 break-words leading-5">
              <p>Status: {testResult?.status ?? "Not tested"}</p>
              <p>Model: {testResult?.config?.model ?? (connection === "personal" ? fields.model : serverDisplayModel)}</p>
              <p>Endpoint: {testResult?.config?.baseUrl ?? (connection === "personal" ? fields.baseUrl : serverStatus?.config?.baseUrl)}</p>
              {lastError ? <p>Last error: {lastError.message} · {new Date(lastError.occurredAt).toLocaleString("en-US")}</p> : <p>No stored API errors.</p>}
            </div>
          </details>
          <WorkspaceDataTools />
          <details className="text-xs">
            <summary className="cursor-pointer py-1">Server setup</summary>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-50 p-3 leading-6">{"DEEPSEEK_API_KEY=your_deepseek_api_key\nDEEPSEEK_BASE_URL=https://api.deepseek.com\nDEEPSEEK_MODEL=deepseek-flash\nDEEPSEEK_TIMEOUT_MS=120000"}</pre>
            <p className="mt-2 leading-5">For development, set these values in .env.local and restart. For Docker, set them in .env.production and recreate the app container.</p>
          </details>
          <div className="flex flex-wrap gap-4 text-sm">
            <button type="button" onClick={() => { resetOnboarding(); router.push("/chat"); }} className="min-h-11 underline underline-offset-2">Show guide again</button>
            <Link href="/knowledge-base" className="inline-flex min-h-11 items-center underline underline-offset-2">Open knowledge base</Link>
          </div>
        </div> : null}
      </details>
    </div>
  );
}
