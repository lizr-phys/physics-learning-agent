"use client";

import { workspaceStorage } from "@/lib/workspace-storage";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceDataTools } from "@/components/layout/WorkspaceDataTools";
import { Loader2 } from "lucide-react";

import {
  clearLastApiError,
  getLastApiError,
  saveLastApiError,
  type StoredApiError,
} from "@/lib/api-diagnostics";
import {
  clearClientProviderSessionKey,
  clientProviderPresets,
  getClientProviderOverride,
  getClientProviderPreset,
  getClientProviderPublicConfig,
  saveClientProviderPublicConfig,
  saveClientProviderSessionKey,
} from "@/lib/client-provider";
import { resetOnboarding } from "@/lib/preferences";
import type { ClientProviderId } from "@/types/learning";

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
  {id:"deepseek-flash",label:"DeepSeek V4.1 Flash · Images"},
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

async function testClientProviderConnection() {
  const provider = getClientProviderOverride();

  if (!provider) {
    throw new Error("Enable BYOK and enter a provider API key before testing.");
  }

  const response = await fetch("/api/deepseek/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientProvider: provider }),
  });
  return (await response.json()) as ApiStatus;
}

export default function ApiSettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [byokStatus, setByokStatus] = useState<ApiStatus | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [selectedModel, setSelectedModel] = useState("deepseek-flash");
  const [byokEnabled, setByokEnabled] = useState(false);
  const [byokProvider, setByokProvider] = useState<ClientProviderId>("deepseek");
  const [byokBaseUrl, setByokBaseUrl] = useState("");
  const [byokModel, setByokModel] = useState("");
  const [byokApiKey, setByokApiKey] = useState("");
  const [byokHasSessionKey, setByokHasSessionKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingByok, setIsTestingByok] = useState(false);
  const [lastError, setLastError] = useState<StoredApiError | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedModel(workspaceStorage().getItem("pla.deepseek.model") ?? "deepseek-flash");
      setLastError(getLastApiError());
      const providerConfig = getClientProviderPublicConfig();
      setByokEnabled(providerConfig.enabled);
      setByokProvider(providerConfig.provider);
      setByokBaseUrl(providerConfig.baseUrl);
      setByokModel(providerConfig.model);
      setByokHasSessionKey(providerConfig.hasSessionKey);
    }, 0);

    fetchApiStatus("status").then(setStatus).catch(() => {
      setStatus({
        ok: false,
        status: "request-failed",
        message: "Unable to read API configuration status.",
        config: {
          configured: false,
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-flash",
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
    workspaceStorage().setItem("pla.deepseek.model", model);
    window.dispatchEvent(new Event("pla:user-data-changed"));
  }

  function handleByokProviderChange(provider: ClientProviderId) {
    const preset = getClientProviderPreset(provider);
    if (provider !== byokProvider) {
      clearClientProviderSessionKey(); setByokHasSessionKey(false); setByokApiKey("");
    }
    setByokStatus(null); setSaveNotice("");

    setByokProvider(preset.id);
    setByokBaseUrl(preset.defaultBaseUrl ?? "");
    setByokModel(preset.defaultModel);
  }

  function saveByokConfig(enabled = byokEnabled) {
    const preset = getClientProviderPreset(byokProvider);

    saveClientProviderPublicConfig({
      enabled,
      provider: byokProvider,
      label: preset.label,
      baseUrl: byokBaseUrl,
      model: byokModel,
    });

    if (byokApiKey.trim()) {
      saveClientProviderSessionKey(byokApiKey);
      setByokHasSessionKey(true);
      setByokApiKey("");
    } else {
      setByokHasSessionKey(getClientProviderPublicConfig().hasSessionKey);
    }
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
            model: "deepseek-flash",
            thinkingMode: "disabled",
            timeoutMs: 120000,
            streaming: true,
          },
      }));
    } finally {
      setIsTesting(false);
    }
  }

  async function testByokConnection() {
    setIsTestingByok(true);

    try {
      saveByokConfig(true);
      setByokEnabled(true);
      const nextStatus = await testClientProviderConnection();
      setByokStatus(nextStatus);

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
      const message = error instanceof Error ? error.message : "Custom provider test failed.";
      setByokStatus({ ok: false, status: "custom-provider-failed", message, config: { configured: byokHasSessionKey, baseUrl: byokBaseUrl, model: byokModel, thinkingMode: "disabled", timeoutMs: 120000, streaming: true } });
      const nextError = {
        message,
        status: "custom-provider-failed",
        occurredAt: Date.now(),
      };
      saveLastApiError(nextError);
      setLastError(nextError);
    } finally {
      setIsTestingByok(false);
    }
  }

  const selectedProviderPreset = getClientProviderPreset(byokProvider);
  const activeStatus = byokEnabled ? byokStatus : status;

  function selectConnection(enabled: boolean) {
    setByokEnabled(enabled); setSaveNotice("");
    const saved = getClientProviderPublicConfig();
    saveClientProviderPublicConfig({ ...saved, enabled });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-5 py-8 md:px-8">
      <header><h1 className="text-2xl font-semibold tracking-tight text-zinc-950">API Settings</h1><p className="mt-2 text-sm leading-6 text-zinc-500">Choose how to connect your model.</p></header>
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-zinc-800">Connection</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
          {([{value:false,label:'Server default'}, {value:true,label:'My API key'}]).map(option => <label key={option.label} className="cursor-pointer"><input type="radio" name="connection-source" checked={byokEnabled === option.value} onChange={() => selectConnection(option.value)} className="peer sr-only" /><span className="block rounded-lg px-3 py-2.5 text-center text-sm text-zinc-500 peer-checked:bg-white peer-checked:font-medium peer-checked:text-zinc-950 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-500">{option.label}</span></label>)}
        </div>
      </fieldset>
      {byokEnabled ? <section className="space-y-5" aria-label="Bring Your Own Key">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-xs text-zinc-600">Provider<select aria-label="Provider" value={byokProvider} onChange={event => handleByokProviderChange(event.target.value as ClientProviderId)} className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950">{clientProviderPresets.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
          <label className="block space-y-2 text-xs text-zinc-600">Model<input value={byokModel} onChange={event => { setByokModel(event.target.value); setByokStatus(null); setSaveNotice(""); }} placeholder={selectedProviderPreset.defaultModel || 'model-name'} className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm text-zinc-950" /></label>
        </div>
        <label className="block space-y-2 text-xs text-zinc-600">API Key<input type="password" autoComplete="off" value={byokApiKey} onChange={event => { setByokApiKey(event.target.value); setByokStatus(null); setSaveNotice(""); }} placeholder={byokHasSessionKey ? 'A key is saved for this tab' : 'Paste your provider key'} className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm text-zinc-950" /></label>
        <p className="text-xs leading-5 text-zinc-500">Your key stays in this browser tab and is excluded from account sync. Choose a model with image support for photos.</p>
        <details className="text-xs text-zinc-600"><summary className="cursor-pointer py-1">Connection details</summary><div className="mt-3 space-y-3">
          <p className="leading-5">{selectedProviderPreset.description}</p>
          {selectedProviderPreset.baseUrlEditable ? <label className="block space-y-2">Base URL<input value={byokBaseUrl} onChange={event => { setByokBaseUrl(event.target.value); setByokStatus(null); }} placeholder="https://api.example.com/v1" className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm" /></label> : <p>This provider uses its native API endpoint.</p>}
          {byokHasSessionKey ? <button type="button" onClick={() => { clearClientProviderSessionKey(); setByokHasSessionKey(false); setByokApiKey(''); setByokStatus(null); setSaveNotice('Session key cleared.'); }} className="min-h-9 underline">Clear session key</button> : null}
        </div></details>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { saveByokConfig(true); setSaveNotice('Connection saved for this browser.'); }} className="rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white">Save for this browser</button>
          <button type="button" onClick={() => void testByokConnection()} disabled={isTestingByok} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 disabled:opacity-40">{isTestingByok ? <Loader2 size={14} className="animate-spin" /> : null}{isTestingByok ? 'Testing…' : 'Test provider'}</button>
        </div>
        {saveNotice ? <p role="status" className="text-xs text-zinc-600">{saveNotice}</p> : null}
      </section> : <section className="space-y-5" aria-label="Server Default Provider">
        <label className="block space-y-2 text-xs text-zinc-600">Model<select aria-label="Server model preference" value={selectedModel} onChange={event => handleModelChange(event.target.value)} className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950">{modelOptions.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
        <button type="button" onClick={() => void testConnection()} disabled={isTesting} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 disabled:opacity-40">{isTesting ? <Loader2 size={14} className="animate-spin" /> : null}{isTesting ? 'Testing…' : 'Test connection'}</button>
      </section>}
      {activeStatus ? <p role="status" className="text-sm leading-6 text-zinc-600">{activeStatus.message}</p> : null}
      <details className="border-t border-zinc-200 pt-5 text-sm text-zinc-600">
        <summary className="cursor-pointer font-medium">Advanced</summary>
        <div className="mt-5 space-y-5">
          <details className="text-xs"><summary className="cursor-pointer py-1">Diagnostics</summary><div className="mt-3 space-y-2 break-words leading-5">
            <p>Status: {activeStatus?.status ?? 'Not tested'}</p><p>Model: {activeStatus?.config.model ?? (byokEnabled ? byokModel : selectedModel)}</p><p>Endpoint: {activeStatus?.config.baseUrl ?? (byokEnabled ? byokBaseUrl : status?.config.baseUrl)}</p><p>Timeout: {activeStatus?.config.timeoutMs ?? 120000} ms</p>
            {lastError ? <p>Last error: {lastError.message} · {new Date(lastError.occurredAt).toLocaleString('en-US')}</p> : <p>No stored API errors.</p>}
          </div></details>
          <WorkspaceDataTools />
          <details className="text-xs"><summary className="cursor-pointer py-1">Server setup</summary><pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-50 p-3 leading-6">{`DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_TIMEOUT_MS=120000`}</pre><p className="mt-2 leading-5">Set these values in .env.local and restart the development server.</p></details>
          <div className="flex flex-wrap gap-4 text-xs"><button type="button" onClick={() => { resetOnboarding(); router.push('/chat'); }} className="min-h-9 underline">Show guide again</button><a href="/knowledge-base" className="inline-flex min-h-9 items-center underline">Open knowledge base</a></div>
        </div>
      </details>
    </div>
  );
}
