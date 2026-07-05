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
    defaultModel: "deepseek-chat",
    description: "DeepSeek OpenAI-compatible chat endpoint.",
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

export function getClientProviderPublicConfig(): ClientProviderPublicConfig {
  if (!hasBrowserStorage()) {
    const preset = getClientProviderPreset("openai");

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

  const preset = getClientProviderPreset(window.localStorage.getItem(providerKey));
  const savedBaseUrl = window.localStorage.getItem(baseUrlKey);
  const savedModel = window.localStorage.getItem(modelKey);

  return {
    enabled: window.localStorage.getItem(enabledKey) === "1",
    provider: preset.id,
    type: preset.type,
    label: window.localStorage.getItem(labelKey) || preset.label,
    baseUrl: savedBaseUrl ?? preset.defaultBaseUrl ?? "",
    model: savedModel || preset.defaultModel,
    hasSessionKey: Boolean(window.sessionStorage.getItem(apiKeySessionKey)),
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

  window.localStorage.setItem(enabledKey, input.enabled ? "1" : "0");
  window.localStorage.setItem(providerKey, preset.id);
  window.localStorage.setItem(labelKey, input.label?.trim() || preset.label);
  window.localStorage.setItem(baseUrlKey, input.baseUrl?.trim() || preset.defaultBaseUrl || "");
  window.localStorage.setItem(modelKey, input.model.trim());
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function saveClientProviderSessionKey(apiKey: string) {
  if (!hasBrowserStorage()) {
    return;
  }

  const trimmed = apiKey.trim();

  if (trimmed) {
    window.sessionStorage.setItem(apiKeySessionKey, trimmed);
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
  const apiKey = window.sessionStorage.getItem(apiKeySessionKey)?.trim() ?? "";

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
