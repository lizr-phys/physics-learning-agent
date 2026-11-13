export const serverModelOptions = [
  { id: "deepseek-flash", label: "DeepSeek V4.1 Flash · Images" },
  { id: "deepseek-v4-flash", label: "deepseek-v4-flash" },
  { id: "deepseek-v4-flash-vision-exp", label: "deepseek-v4-flash-vision-exp" },
  { id: "deepseek-v4-pro", label: "deepseek-v4-pro" },
  { id: "deepseek-chat", label: "deepseek-chat (compatible alias)" },
  { id: "deepseek-reasoner", label: "deepseek-reasoner (compatible alias)" },
] as const;

const modelIds = new Set<string>(serverModelOptions.map(({ id }) => id));

export function isServerModelId(value: unknown): value is string {
  return typeof value === "string" && modelIds.has(value);
}
