"use client";

import { workspaceStorage } from "@/lib/workspace-storage";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceDataTools } from "@/components/layout/WorkspaceDataTools";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

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
      const message = error instanceof Error ? error.message : "Custom provider test failed.";
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          API Settings
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Connect DeepSeek V4.1 Flash or another model with image support.
        </p>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-950">Server Default Provider</h2>
          <label className="block text-sm text-zinc-600">
            Model
            <select aria-label="Server model preference" value={selectedModel} onChange={event => handleModelChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950">
              {modelOptions.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </label>
          <p className="text-xs text-zinc-500">Used when your own key is disabled. Flash supports images; Pro is text only.</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {status?.ok ? (
                <CheckCircle2 size={16} className="text-zinc-950" />
              ) : (
                <XCircle size={16} className="text-zinc-500" />
              )}
              <span>Server API key: {status?.config.configured ? "configured" : "not configured"}</span>
            </div>
            <details className="text-xs">
            <summary className="cursor-pointer py-1">Connection details</summary>
            <div className="mt-2 space-y-2 break-all">
            <p className="text-zinc-600">Server model: {status?.config.model ?? "Loading..."}</p>
            <p className="text-zinc-600">Browser model preference: {selectedModel}</p>
            <p className="text-zinc-600">Base URL: {status?.config.baseUrl ?? "Loading..."}</p>
            <p className="text-zinc-600">
              Response mode: {status?.config.streaming ? "streaming" : "non-streaming"}
            </p>
            <p className="text-zinc-600">Thinking: {status?.config.thinkingMode ?? "Loading..."}</p>
            <p className="text-zinc-600">Timeout: {status?.config.timeoutMs ?? 120000} ms</p>
            </div>
            </details>
          </div>

          {lastError ? <div role="alert" className="border-l-2 border-red-300 pl-3 text-sm">
            <p className="font-medium text-zinc-950">Last API Error</p>
            {lastError ? (
              <>
                <p className="mt-2 leading-6 text-zinc-700">{lastError.message}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {lastError.status ?? "unknown"} |{" "}
                  {new Date(lastError.occurredAt).toLocaleString("en-US")}
                </p>
              </>
            ) : (
              <p className="mt-2 text-zinc-500">No API error is stored in this browser.</p>
            )}
          </div> : null}

          <div role="status" className="text-sm text-zinc-700">
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
          <WorkspaceDataTools />
        </section>

        <aside className="space-y-4">
          <section className="border-t border-zinc-200 pt-4 lg:border-t-0 lg:pt-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950">Bring Your Own Key</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Your key stays in this browser tab.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={byokEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setByokEnabled(enabled);
                    saveByokConfig(enabled);
                  }}
                />
                Enable
              </label>
            </div>

            {byokEnabled ? <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-zinc-600">
                Provider
                <select
                  value={byokProvider}
                  onChange={(event) => handleByokProviderChange(event.target.value as ClientProviderId)}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500"
                >
                  {clientProviderPresets.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>

              <p className="text-xs leading-5 text-zinc-600">
                {selectedProviderPreset.description}
              </p>

              {selectedProviderPreset.baseUrlEditable ? (
                <label className="block text-xs font-medium text-zinc-600">
                  Base URL
                  <input
                    value={byokBaseUrl}
                    onChange={(event) => setByokBaseUrl(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500"
                    placeholder="https://api.example.com/v1"
                  />
                </label>
              ) : (
                <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-600">
                  This provider uses its native API endpoint. Only the model name and API key are
                  required.
                </p>
              )}

              <label className="block text-xs font-medium text-zinc-600">
                Model
                <input
                  value={byokModel}
                  onChange={(event) => setByokModel(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500"
                  placeholder={selectedProviderPreset.defaultModel || "model-name"}
                />
              </label>

              <label className="block text-xs font-medium text-zinc-600">
                API Key
                <input
                  type="password"
                  value={byokApiKey}
                  onChange={(event) => setByokApiKey(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500"
                  placeholder={byokHasSessionKey ? "Session key is already set" : "Paste key for this browser tab"}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    saveByokConfig(true);
                    setByokEnabled(true);
                  }}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  Save for this browser
                </button>
                <button
                  type="button"
                  onClick={() => void testByokConnection()}
                  disabled={isTestingByok}
                  className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-xs font-medium text-white disabled:bg-zinc-400"
                >
                  {isTestingByok ? <Loader2 size={14} className="animate-spin" /> : null}
                  Test provider
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearClientProviderSessionKey();
                    setByokHasSessionKey(false);
                  }}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  Clear session key
                </button>
              </div>

              <p className="text-xs leading-5 text-zinc-500">
                Keys are excluded from account sync. Image support depends on the selected model.
              </p>
            </div> : null}
          </section>

          <details className="border-t border-zinc-200 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-950">Server setup</summary>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700">
{`DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_TIMEOUT_MS=120000`}
            </pre>
            {!status?.config.configured ? (
              <p className="mt-3 text-xs leading-5 text-zinc-600">
                Configure DEEPSEEK_API_KEY in `.env.local`, then restart the development server.
              </p>
            ) : null}
          </details>

          <details className="border-t border-zinc-200 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-950">Help and study materials</summary>
            <button
              type="button"
              onClick={() => {
                resetOnboarding();
                router.push("/chat");
              }}
              className="mt-3 rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Show guide again
            </button>
            <a
              href="/knowledge-base"
              className="mt-3 inline-flex rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Open knowledge base
            </a>
          </details>
        </aside>
      </div>
    </div>
  );
}
