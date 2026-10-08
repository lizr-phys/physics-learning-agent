import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guestMediaToken, importGuestImages, uploadImage } from "@/lib/image-client";
import { switchWorkspace } from "@/lib/workspace-storage";
import type { ImageAttachment } from "@/types/learning";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => values.delete(key), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } };
}
const image: ImageAttachment = { id: "image-00000000-0000-4000-8000-000000000001", name: "diagram.png", mimeType: "image/webp", width: 40, height: 30, size: 100 };
beforeEach(() => {
  const local = memoryStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("window", { localStorage: local, sessionStorage: memoryStorage(), dispatchEvent: vi.fn(() => true) });
  vi.stubGlobal("navigator", { locks: { request: (_name: string, action: () => string) => Promise.resolve(action()) } });
});
afterEach(() => vi.unstubAllGlobals());

describe("image client account isolation", () => {
  it("uses the same anonymous identity for concurrent uploads and after account switching", async () => {
    const [first, second] = await Promise.all([guestMediaToken(), guestMediaToken()]);
    expect(first).toMatch(/^[0-9a-f]{64}$/); expect(first).toBe(second);
    switchWorkspace("account-a"); switchWorkspace(null);
    expect(await guestMediaToken()).toBe(first);
  });
  it("rejects a delayed upload callback after the workspace changes", async () => {
    let release!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
    switchWorkspace("account-a");
    const result = uploadImage(new File(["synthetic"], "diagram.png", { type: "image/png" }), new AbortController().signal);
    switchWorkspace("account-b"); release(Response.json({ image }));
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
  it("refuses unsupported files before sending any request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(uploadImage(new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }), new AbortController().signal)).rejects.toThrow("JPEG");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("remaps image references in chat, tool context and unfinished practice only on explicit import", async () => {
    switchWorkspace("account-a"); const copy = { ...image, id: "image-00000000-0000-4000-8000-000000000002" };
    const fetch = vi.fn(async () => Response.json({ images: { [image.id]: copy } })); vi.stubGlobal("fetch", fetch);
    const snapshot = { sessions: [{ messages: [{ images: [image] }], toolContext: { images: [image] } }], practiceHistory: [{ originalRequest: { images: [image] } }] };
    expect(JSON.stringify(await importGuestImages(snapshot))).not.toContain(image.id);
    expect(snapshot.sessions[0].messages[0].images[0].id).toBe(image.id);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
