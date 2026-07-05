"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Settings, XCircle } from "lucide-react";

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
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState("deepseek-v4-flash");
  const [byokEnabled, setByokEnabled] = useState(false);
  const [byokProvider, setByokProvider] = useState<ClientProviderId>("openai");
  const [byokBaseUrl, setByokBaseUrl] = useState("");
  const [byokModel, setByokModel] = useState("");
  const [byokApiKey, setByokApiKey] = useState("");
  const [byokHasSessionKey, setByokHasSessionKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingByok, setIsTestingByok] = useState(false);
  const [lastError, setLastError] = useState<StoredApiError | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedModel(window.localStorage.getItem("pla.deepseek.model") ?? "deepseek-v4-flash");
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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <section className="border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
          <Settings size={16} />
          API Settings
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Model Provider Settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Use the server-configured DeepSeek provider, or bring your own key for OpenAI,
          DeepSeek, Qwen, Kimi, GLM, Claude, Gemini, OpenRouter, or a compatible endpoint.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Server Default Provider</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {status?.ok ? (
                <CheckCircle2 size={16} className="text-zinc-950" />
              ) : (
                <XCircle size={16} className="text-zinc-500" />
              )}
              <span>Server API key: {status?.config.configured ? "configured" : "not configured"}</span>
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
                  {lastError.status ?? "unknown"} |{" "}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950">Bring Your Own Key</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Use your own OpenAI, DeepSeek, Qwen, Kimi, GLM, Claude, Gemini, OpenRouter, or
                  compatible model key. Requests still go through the server route; the key is kept
                  in this browser tab&apos;s sessionStorage.
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

            <div className="mt-4 space-y-3">
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

              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
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
                Key persistence: API keys are not written to localStorage or the server data
                directory. Closing this browser tab clears the session key in most browsers.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-950">Server Model Preference</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Used when BYOK is disabled. The selection is stored in this browser&apos;s
              localStorage. Requests still go through the server and never expose the server API
              key.
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
            <h2 className="text-sm font-semibold text-zinc-950">Personal Knowledge Base</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Uploaded notes are managed from the Personal Knowledge page. Text-like files are
              indexed locally and can be retrieved during chat without exposing document content to
              the browser beyond the snippets used in answers.
            </p>
            <a
              href="/knowledge-base"
              className="mt-3 inline-flex rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Open knowledge base
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
