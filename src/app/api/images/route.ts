import { NextRequest, NextResponse } from "next/server";
import { imageRequestOwner, setGuestImageCookie } from "@/lib/image-request-owner";
import { ImageInputError, storeImage, listStoredImages } from "@/lib/image-store";
import { IMAGE_LIMITS } from "@/lib/image-attachments";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function GET(request:NextRequest) {
  try {
    const {owner,newCookie}=await imageRequestOwner(request,true);
    const images=request.nextUrl.searchParams.get("mode")==="session" ? [] : await listStoredImages(owner!);
    const response=NextResponse.json({images},{headers:{"Cache-Control":"private, no-store"}}); setGuestImageCookie(response,newCookie); return response;
  } catch(error) {return NextResponse.json({error:error instanceof ImageInputError ? error.message : "Images could not be loaded."},{status:error instanceof ImageInputError ? error.status : 503});}
}
export async function POST(request: NextRequest) {
  try {
    const {owner,user,newCookie} = await imageRequestOwner(request,true);
    if (!consumeRateLimit(`images:${user?.id ?? getRequestClientKey(request)}`,60,10*60*1000).allowed) return NextResponse.json({error:"Too many image uploads. Try again shortly."},{status:429});
    if (Number(request.headers.get("content-length")) > IMAGE_LIMITS.uploadBytes) throw new ImageInputError("Choose an image up to 10 MB.",413);
    const reader = request.body?.getReader(); const parts:Uint8Array[]=[]; let size=0;
    if (!reader) throw new ImageInputError("Choose an image to upload.");
    try {
      while (true) { const result=await reader.read(); if (result.done) break; size+=result.value.length; if (size>IMAGE_LIMITS.uploadBytes) { await reader.cancel(); throw new ImageInputError("Choose an image up to 10 MB.",413); } parts.push(result.value); }
    } finally { reader.releaseLock(); }
    let name="Image"; try { name=decodeURIComponent(request.headers.get("X-Image-Name") ?? "Image"); } catch { /* Safe fallback. */ }
    const image=await storeImage(owner!,Buffer.concat(parts),name);
    const response=NextResponse.json({image},{headers:{"Cache-Control":"private, no-store"}}); setGuestImageCookie(response,newCookie); return response;
  } catch(error) { return NextResponse.json({error:error instanceof ImageInputError ? error.message : "The image could not be saved.",code:error instanceof ImageInputError ? error.code : "IMAGE_SAVE_FAILED"},{status:error instanceof ImageInputError ? error.status : 503}); }
}
