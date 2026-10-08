import { NextRequest,NextResponse } from "next/server";
import { imageRequestOwner } from "@/lib/image-request-owner";
import { ImageInputError,copyStoredImage,removeStoredImage } from "@/lib/image-store";
import { readJsonRequest, RequestBodyError } from "@/lib/request-body";
import { imageIdPattern } from "@/lib/image-attachments";
export const runtime="nodejs";
export async function POST(request:NextRequest) {
  try {
    const {owner,user,guestOwner}=await imageRequestOwner(request);
    if (!user || !guestOwner) throw new ImageInputError("Sign in to import images from this browser's anonymous workspace.",401);
    const body=await readJsonRequest<{ids?:unknown}>(request,16*1024);
    if (!Array.isArray(body.ids) || body.ids.length>256 || body.ids.some(id=>typeof id!=="string" || !imageIdPattern.test(id))) throw new ImageInputError("The image import selection is invalid.");
    const images:Record<string,Awaited<ReturnType<typeof copyStoredImage>>>={};
    try { for (const id of new Set(body.ids as string[])) images[id]=await copyStoredImage(guestOwner,owner!,id); }
    catch(error) { await Promise.all(Object.values(images).map(image=>removeStoredImage(owner!,image.id).catch(()=>undefined))); throw error; }
    return NextResponse.json({images},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return NextResponse.json({error:error instanceof ImageInputError || error instanceof RequestBodyError ? error.message : "Anonymous images could not be imported. Their originals are retained."},{status:error instanceof ImageInputError || error instanceof RequestBodyError ? error.status : 503}); }
}
