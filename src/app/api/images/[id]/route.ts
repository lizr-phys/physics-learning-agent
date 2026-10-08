import { NextRequest, NextResponse } from "next/server";
import { imageRequestOwner } from "@/lib/image-request-owner";
import { ImageInputError, readStoredImage, removeStoredImage } from "@/lib/image-store";
import { readUserData } from "@/lib/user-data-server";
import { listPersonalDocuments } from "@/lib/personal-knowledge";
import { withKeyedLock } from "@/lib/async-lock";
export const runtime="nodejs";
type Context = {params:Promise<{id:string}>};
export async function GET(request:NextRequest, context:Context) {
  try {
    const {owner}=await imageRequestOwner(request); if (!owner) throw new ImageInputError("Image not found in this workspace.",404);
    const {image,data}=await readStoredImage(owner,(await context.params).id);
    return new Response(new Uint8Array(data),{headers:{"Content-Type":image.mimeType,"Content-Length":String(data.length),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error) { return NextResponse.json({error:error instanceof ImageInputError ? error.message : "Image unavailable."},{status:error instanceof ImageInputError ? error.status : 503}); }
}
export async function DELETE(request:NextRequest, context:Context) {
  try {
    const {owner,user}=await imageRequestOwner(request); if (!owner) throw new ImageInputError("Image not found in this workspace.",404);
    const {id}=await context.params;
    await withKeyedLock(user ? `workspace:${user.id}` : `image-reference:${owner}`, async () => {
    if (user) {
      const [snapshot,documents]=await Promise.all([readUserData(user.id),listPersonalDocuments(user.id)]);
      const referenced=JSON.stringify({sessions:snapshot.sessions,practiceHistory:snapshot.practiceHistory,documents}).includes(`"${id}"`);
      if (referenced) throw new ImageInputError("This image belongs to a saved conversation or practice set. Keep it with that record.",409,"IMAGE_IN_USE");
    }
    await removeStoredImage(owner,id);
    });
    return NextResponse.json({deleted:true});
  } catch(error) { return NextResponse.json({error:error instanceof ImageInputError ? error.message : "Image removal failed."},{status:error instanceof ImageInputError ? error.status : 503}); }
}
