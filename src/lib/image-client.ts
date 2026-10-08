"use client";
import { getWorkspaceIdentity,isWorkspaceCurrent,workspaceKey } from "@/lib/workspace-storage";
import { IMAGE_LIMITS } from "@/lib/image-attachments";
import type { ImageAttachment } from "@/types/learning";
const tokenKey=()=>workspaceKey("pla.image-token.v1",null);
export async function guestMediaToken() {
  const initialize=()=>{
    const previous=localStorage.getItem(tokenKey()); if (previous && /^[0-9a-f]{64}$/.test(previous)) return previous;
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,"0")).join("");
    localStorage.setItem(tokenKey(),token); return token;
  };
  return navigator.locks ? navigator.locks.request("pla-guest-image-identity",initialize) : initialize();
}
export async function restoreGuestImageSession() {
  const token=localStorage.getItem(tokenKey()); if (!token || getWorkspaceIdentity().ownerId) return;
  const identity=getWorkspaceIdentity();
  await fetch("/api/images?mode=session",{cache:"no-store",headers:{"X-PLA-Workspace-Owner":"guest","X-PLA-Guest-Media-Token":token}});
  if (!isWorkspaceCurrent(identity)) throw new DOMException("Workspace changed","AbortError");
}
export async function uploadImage(file:File,signal:AbortSignal) {
  if (!/^(image\/(jpeg|png|webp|gif))$/.test(file.type)) throw new Error("Use JPEG, PNG, WebP or GIF images.");
  if (file.size>IMAGE_LIMITS.uploadBytes) throw new Error("Choose an image up to 10 MB.");
  const identity=getWorkspaceIdentity();
  const headers:Record<string,string>={"Content-Type":file.type,"X-Image-Name":encodeURIComponent(file.name),"X-PLA-Workspace-Owner":identity.ownerId ?? "guest"};
  if (!identity.ownerId) headers["X-PLA-Guest-Media-Token"]=await guestMediaToken();
  const response=await fetch("/api/images",{method:"POST",headers,body:file,signal});
  const body=await response.json();
  if (!isWorkspaceCurrent(identity) || signal.aborted) throw new DOMException("Workspace changed","AbortError");
  if (!response.ok) throw new Error(body.error || "Image upload failed.");
  return body.image as ImageAttachment;
}
export function snapshotImageRefs(input:unknown):ImageAttachment[] {
  if (!input || typeof input!=="object") return [];
  if (Array.isArray(input)) return input.flatMap(snapshotImageRefs);
  return Object.entries(input).flatMap(([key,value])=> key==="images" && Array.isArray(value) ? value as ImageAttachment[] : snapshotImageRefs(value));
}
export async function importGuestImages<T>(snapshot:T, signal?:AbortSignal):Promise<T> {
  const ids=[...new Set(snapshotImageRefs(snapshot).map(image=>image.id))]; if (!ids.length) return snapshot;
  const identity=getWorkspaceIdentity();
  const response=await fetch("/api/images/import",{method:"POST",headers:{"Content-Type":"application/json","X-PLA-Workspace-Owner":identity.ownerId ?? "guest","X-PLA-Guest-Media-Token":await guestMediaToken()},body:JSON.stringify({ids}),signal});
  const body=await response.json(); if (!isWorkspaceCurrent(identity) || signal?.aborted) throw new DOMException("Workspace changed","AbortError");
  if (!response.ok) throw new Error(body.error || "Anonymous images could not be imported.");
  function replace(value:unknown):unknown {
    if (Array.isArray(value)) return value.map(replace);
    if (!value || typeof value!=="object") return value;
    return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,key==="images" && Array.isArray(entry) ? entry.map(image=>body.images[image.id] ?? image) : replace(entry)]));
  }
  return replace(snapshot) as T;
}
