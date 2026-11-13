import { runWorkspaceTransaction, workspaceStorage } from "@/lib/workspace-storage";
import { isServerModelId } from "@/lib/server-models";
import type {
  ClientProviderConfig,
  ClientProviderId,
  ClientProviderKind,
} from "@/types/learning";

const enabledKey = "pla.clientProvider.enabled";
const providerKey = "pla.clientProvider.provider";
const labelKey = "pla.clientProvider.label";
const baseUrlKey = "pla.clientProvider.baseUrl";
const modelKey = "pla.clientProvider.model";
const apiKeySessionKey = "pla.clientProvider.apiKey";

export function getStoredServerModel() {
  if (typeof window === "undefined") return undefined;
  const model = workspaceStorage().getItem("pla.deepseek.model");
  return isServerModelId(model) ? model : undefined;
}

export type ClientProviderPreset = {
  id: ClientProviderId;
  label: string;
  type: ClientProviderKind;
  defaultBaseUrl?: string;
  defaultModel: string;
  description: string;
  baseUrlEditable: boolean;
};

export const clientProviderPresets: ClientProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    type: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    description: "OpenAI Chat Completions compatible endpoint.",
    baseUrlEditable: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    type: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-flash",
    description: "V4.1 Flash supports text and images (deepseek-flash).",
    baseUrlEditable: true,
  },
  {
    id: "qwen",
    label: "Qwen / DashScope",
    type: "openai-compatible",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    description: "Alibaba Cloud DashScope OpenAI-compatible mode.",
    baseUrlEditable: true,
  },
  {
    id: "kimi",
    label: "Kimi / Moonshot",
    type: "openai-compatible",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    description: "Moonshot OpenAI-compatible endpoint.",
    baseUrlEditable: true,
  },
  {
    id: "glm",
    label: "GLM / Zhipu",
    type: "openai-compatible",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    description: "Zhipu GLM OpenAI-compatible endpoint.",
    baseUrlEditable: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    type: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    description: "OpenRouter OpenAI-compatible gateway for many models.",
    baseUrlEditable: true,
  },
  {
    id: "anthropic",
    label: "Claude / Anthropic",
    type: "anthropic",
    defaultModel: "claude-3-5-sonnet-latest",
    description: "Anthropic Messages API.",
    baseUrlEditable: false,
  },
  {
    id: "gemini",
    label: "Gemini / Google",
    type: "gemini",
    defaultModel: "gemini-1.5-flash",
    description: "Google Gemini generateContent API.",
    baseUrlEditable: false,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    type: "openai-compatible",
    defaultBaseUrl: "",
    defaultModel: "",
    description: "Any provider that exposes an OpenAI-compatible /chat/completions API.",
    baseUrlEditable: true,
  },
];

function hasBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage && window.sessionStorage);
}

export function getClientProviderPreset(provider: string | null | undefined) {
  return (
    clientProviderPresets.find((item) => item.id === provider) ??
    clientProviderPresets.find((item) => item.id === "openai")!
  );
}

export type ClientProviderPublicConfig = {
  enabled: boolean;
  provider: ClientProviderId;
  type: ClientProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  hasSessionKey: boolean;
};

type ProviderTarget = Pick<ClientProviderPublicConfig, "provider" | "baseUrl">;

function savedTarget(): ProviderTarget {
  const preset = getClientProviderPreset(workspaceStorage().getItem(providerKey) ?? "deepseek");
  return { provider: preset.id, baseUrl: workspaceStorage().getItem(baseUrlKey) ?? preset.defaultBaseUrl ?? "" };
}

function targetId({ provider, baseUrl }: ProviderTarget) {
  const preset = getClientProviderPreset(provider);
  const endpoint = preset.type === "openai-compatible"
    ? (baseUrl.trim() || preset.defaultBaseUrl || "").replace(/\/+$/, "").replace(/\/chat\/completions$/i, "")
    : "";
  return JSON.stringify([provider, endpoint]);
}

export function getClientProviderSessionKey(target?: ProviderTarget) {
  if (!hasBrowserStorage()) return "";
  const raw = window.sessionStorage.getItem(apiKeySessionKey);
  if (!raw) return "";
  const saved = savedTarget();
  const id = targetId(target ?? saved);
  if (raw.startsWith("{")) {
    try {
      const entry = JSON.parse(raw) as { target?: string; key?: string };
      return entry.target === id && typeof entry.key === "string" ? entry.key : "";
    } catch { return ""; }
  }
  // The previous release stored only the key. Bind it to the saved endpoint
  // during workspace startup, never to an unsaved test target.
  if (id !== targetId(saved)) return "";
  return raw.trim();
}

export function bindLegacyProviderSessionKey() {
  if (!hasBrowserStorage()) return;
  const raw = window.sessionStorage.getItem(apiKeySessionKey);
  if (raw && !raw.startsWith("{")) saveClientProviderSessionKey(raw, savedTarget());
}

export function getClientProviderPublicConfig(): ClientProviderPublicConfig {
  if (!hasBrowserStorage()) {
    const preset = getClientProviderPreset("deepseek");

    return {
      enabled: false,
      provider: preset.id,
      type: preset.type,
      label: preset.label,
      baseUrl: preset.defaultBaseUrl ?? "",
      model: preset.defaultModel,
      hasSessionKey: false,
    };
  }

  const target = savedTarget();
  const preset = getClientProviderPreset(target.provider);
  const savedModel = workspaceStorage().getItem(modelKey);

  return {
    enabled: workspaceStorage().getItem(enabledKey) === "1",
    provider: preset.id,
    type: preset.type,
    label: workspaceStorage().getItem(labelKey) || preset.label,
    baseUrl: target.baseUrl,
    model: savedModel || preset.defaultModel,
    hasSessionKey: Boolean(getClientProviderSessionKey(target)),
  };
}

export function saveClientProviderPublicConfig(input: {
  enabled: boolean;
  provider: ClientProviderId;
  label?: string;
  baseUrl?: string;
  model: string;
}) {
  if (!hasBrowserStorage()) {
    return;
  }

  const preset = getClientProviderPreset(input.provider);

  runWorkspaceTransaction(() => {
    const storage = workspaceStorage();
    storage.setItem(enabledKey, input.enabled ? "1" : "0");
    storage.setItem(providerKey, preset.id);
    storage.setItem(labelKey, input.label?.trim() || preset.label);
    storage.setItem(baseUrlKey, input.baseUrl?.trim() || preset.defaultBaseUrl || "");
    storage.setItem(modelKey, input.model.trim());
  });
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function saveClientProviderSessionKey(apiKey: string, target?: ProviderTarget) {
  if (!hasBrowserStorage()) {
    return;
  }

  const trimmed = apiKey.trim();

  if (trimmed) {
    window.sessionStorage.setItem(apiKeySessionKey, JSON.stringify({ key: trimmed, target: targetId(target ?? savedTarget()) }));
  } else {
    window.sessionStorage.removeItem(apiKeySessionKey);
  }
}

export function clearClientProviderSessionKey() {
  if (!hasBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(apiKeySessionKey);
}

export function getClientProviderOverride(): ClientProviderConfig | undefined {
  if (!hasBrowserStorage()) {
    return undefined;
  }

  const publicConfig = getClientProviderPublicConfig();
  const apiKey = getClientProviderSessionKey(publicConfig);

  if (!publicConfig.enabled || !apiKey || !publicConfig.model) {
    return undefined;
  }

  if (publicConfig.type === "openai-compatible" && !publicConfig.baseUrl) {
    return undefined;
  }

  return {
    provider: publicConfig.provider,
    type: publicConfig.type,
    label: publicConfig.label,
    apiKey,
    baseUrl: publicConfig.type === "openai-compatible" ? publicConfig.baseUrl : undefined,
    model: publicConfig.model,
  };
}

export function buildClientProviderDraft(input: ProviderTarget & { model: string; apiKey: string }): ClientProviderConfig | undefined {
  const preset = getClientProviderPreset(input.provider);
  const apiKey = input.apiKey.trim() || getClientProviderSessionKey(input);
  const model = input.model.trim();
  const baseUrl = input.baseUrl.trim() || preset.defaultBaseUrl;
  if (!apiKey || !model || (preset.type === "openai-compatible" && !baseUrl)) return undefined;
  if (preset.type === "openai-compatible") {
    let url: URL;
    try { url = new URL(baseUrl!); } catch { return undefined; }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return undefined;
  }
  return { provider: preset.id, type: preset.type, label: preset.label, model, apiKey, baseUrl: preset.type === "openai-compatible" ? baseUrl : undefined };
}

export function getGenerationConnection():
  | { error: string; model?: never; clientProvider?: never }
  | { error?: never; model?: string; clientProvider?: ClientProviderConfig } {
  const provider = getClientProviderPublicConfig();
  const model = getStoredServerModel();
  if (!provider.enabled) return { model };
  const clientProvider = getClientProviderOverride();
  if (!clientProvider) {
    return { error: "The current connection needs a provider key for this tab. Open API Settings to update it or switch to the server connection." };
  }
  return { model, clientProvider };
}
