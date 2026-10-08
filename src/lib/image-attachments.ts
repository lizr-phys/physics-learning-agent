import type { AgentRequest, ImageAttachment } from "@/types/learning";

export const IMAGE_LIMITS = { perMessage: 4, perRequest: 8, uploadBytes: 10 * 1024 * 1024, storedBytes: 2 * 1024 * 1024,
  ownerBytes: 50 * 1024 * 1024, ownerFiles: 256, pixels: 25_000_000, longestSide: 2560 } as const;
export const imageIdPattern = /^image-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function sanitizeImageAttachments(input: unknown): ImageAttachment[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const refs = input.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const image = value as Record<string, unknown>;
    if (typeof image.id !== "string" || !imageIdPattern.test(image.id) || image.mimeType !== "image/webp"
      || ![image.width, image.height, image.size].every(value => Number.isSafeInteger(value) && Number(value) > 0)
      || Number(image.width) > IMAGE_LIMITS.longestSide || Number(image.height) > IMAGE_LIMITS.longestSide || Number(image.size) > IMAGE_LIMITS.storedBytes) return [];
    return [{id:image.id, name:typeof image.name === "string" ? image.name.replace(/[\u0000-\u001f]/g, "").slice(0,160) : "Image",
      mimeType:"image/webp" as const,size:Number(image.size),width:Number(image.width),height:Number(image.height)}];
  });
  return refs.length ? [...new Map(refs.map(image => [image.id,image])).values()] : undefined;
}
export function imageUrl(image: Pick<ImageAttachment, "id">) { return `/api/images/${encodeURIComponent(image.id)}`; }
export function requestImageRefs(input: AgentRequest) {
  const refs = [...(input.images ?? []), ...(input.toolContext?.images ?? []), ...(input.history ?? []).filter(message => message.role === "user").flatMap(message => message.images ?? [])];
  return [...new Map(refs.map(image => [image.id,image])).values()];
}
export function mergeImageAttachments(...values: Array<ImageAttachment[] | undefined>) {
  const images = [...new Map(values.flatMap(value => value ?? []).map(image => [image.id,image])).values()];
  return images.length ? images : undefined;
}
