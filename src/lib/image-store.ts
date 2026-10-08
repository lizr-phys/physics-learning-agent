import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { withKeyedLock } from "@/lib/async-lock";
import { IMAGE_LIMITS, imageIdPattern, sanitizeImageAttachments, requestImageRefs } from "@/lib/image-attachments";
import type { AgentRequest, ImageAttachment } from "@/types/learning";

export class ImageInputError extends Error {
  constructor(message: string, public status = 400, public code = "IMAGE_INPUT_INVALID") { super(message); this.name = "ImageInputError"; }
}
function ownerDirectory(owner: string) {
  if (!owner) throw new ImageInputError("Image access requires a verified workspace.", 404);
  return path.join(process.env.PLA_DATA_DIR || path.join(process.cwd(), ".pla-data"), "images", createHash("sha256").update(owner).digest("hex"));
}
function filePaths(owner: string, id: string) {
  if (!imageIdPattern.test(id)) throw new ImageInputError("Image not found in this workspace.",404,"IMAGE_NOT_FOUND");
  const dir = ownerDirectory(owner);
  return {dir,metadata:path.join(dir,`${id}.json`),data:path.join(dir,`${id}.webp`)};
}
export async function readStoredImage(owner: string, id: string) {
  const files = filePaths(owner,id);
  try {
    // Private runtime files live in the data volume, outside the application bundle.
    const [raw,data] = await Promise.all([readFile(/* turbopackIgnore: true */ files.metadata,"utf8"),readFile(/* turbopackIgnore: true */ files.data)]);
    const record = JSON.parse(raw);
    const image = sanitizeImageAttachments([record])?.[0];
    if (!image || image.id !== id || data.length !== image.size || createHash("sha256").update(data).digest("hex") !== record.hash) throw new Error("Invalid image record");
    return {image,data};
  } catch { throw new ImageInputError("Image not found in this workspace. Reattach it before continuing.",404,"IMAGE_NOT_FOUND"); }
}
export async function storeImage(owner: string, input: Buffer, name: string): Promise<ImageAttachment> {
  if (!input.length || input.length > IMAGE_LIMITS.uploadBytes) throw new ImageInputError("Choose an image up to 10 MB.",413,"IMAGE_TOO_LARGE");
  const signature=input.subarray(0,12);
  if (!(signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || signature.subarray(0,3).equals(Buffer.from([255,216,255]))
    || /^GIF8[79]a/.test(signature.toString("ascii")) || signature.subarray(0,4).toString("ascii")==="RIFF" && signature.subarray(8,12).toString("ascii")==="WEBP")) {
    throw new ImageInputError("Use JPEG, PNG, WebP or GIF images.");
  }
  let data: Buffer, width: number, height: number;
  try {
    const decoder = sharp(input,{limitInputPixels:IMAGE_LIMITS.pixels,failOn:"error"});
    const metadata = await decoder.metadata();
    if (!["jpeg","png","webp","gif"].includes(metadata.format ?? "")) throw new Error("Unsupported format");
    const normalized = await decoder.rotate().resize({width:IMAGE_LIMITS.longestSide,height:IMAGE_LIMITS.longestSide,fit:"inside",withoutEnlargement:true}).webp({quality:92}).toBuffer({resolveWithObject:true});
    data = normalized.data; width = normalized.info.width; height = normalized.info.height;
  } catch { throw new ImageInputError("Use a readable JPEG, PNG, WebP or GIF image, up to 25 megapixels."); }
  if (data.length > IMAGE_LIMITS.storedBytes) throw new ImageInputError("This image is too detailed to save. Crop it or choose a smaller image.",413,"IMAGE_TOO_LARGE");
  return saveNormalizedImage(owner,data,width,height,name);
}
async function saveNormalizedImage(owner:string,data:Buffer,width:number,height:number,name:string) {
  return withKeyedLock(`images:${owner}`, async () => {
    const dir = ownerDirectory(owner); await mkdir(dir,{recursive:true});
    const names = (await readdir(dir)).filter(name => /^image-[0-9a-f-]+\.json$/.test(name));
    const records = await Promise.all(names.map(async name => { try {
      const image=sanitizeImageAttachments([JSON.parse(await readFile(path.join(dir,name),"utf8"))])?.[0];
      if (!image) throw new Error("Invalid metadata"); return image;
    } catch { throw new ImageInputError("Image storage needs repair before more images can be saved.",503); } }));
    if (records.length >= IMAGE_LIMITS.ownerFiles || records.reduce((sum,record) => sum + Number(record.size ?? 0),0) + data.length > IMAGE_LIMITS.ownerBytes) {
      throw new ImageInputError("Image storage is full (50 MB or 256 images). Export and remove unused images before uploading more.",413,"IMAGE_QUOTA_EXCEEDED");
    }
    const image: ImageAttachment = {id:`image-${randomUUID()}`,name:name.replace(/[\u0000-\u001f]/g,"").slice(0,160) || "Image",mimeType:"image/webp",size:data.length,width,height};
    const files = filePaths(owner,image.id);
    try {
      await writeFile(files.data,data,{flag:"wx"});
      await writeFile(files.metadata,JSON.stringify({...image,createdAt:Date.now(),hash:createHash("sha256").update(data).digest("hex")}),{flag:"wx"});
    } catch (error) { await rm(files.data,{force:true}); await rm(files.metadata,{force:true}); throw error; }
    return image;
  });
}
export async function copyStoredImage(sourceOwner:string,destinationOwner:string,id:string) {
  const {image,data}=await readStoredImage(sourceOwner,id);
  return saveNormalizedImage(destinationOwner,data,image.width,image.height,image.name);
}
export async function resolveRequestImages(input: AgentRequest, owner: string) {
  const refs = requestImageRefs(input);
  if (refs.length > IMAGE_LIMITS.perRequest) throw new ImageInputError("Use at most eight images in one request.",413,"IMAGE_QUOTA_EXCEEDED");
  const images = await Promise.all(refs.map(async ref => {
    const {image,data} = await readStoredImage(owner,ref.id);
    return [image.id,{mimeType:image.mimeType,data:data.toString("base64")}] as const;
  }));
  return Object.fromEntries(images);
}
export async function removeStoredImage(owner: string, id: string) {
  return withKeyedLock(`images:${owner}`,async () => {
    await readStoredImage(owner,id); const files = filePaths(owner,id);
    await rm(files.metadata,{force:true}); await rm(files.data,{force:true});
  });
}

export async function listStoredImages(owner: string) {
  const dir=ownerDirectory(owner);
  let names:string[]; try { names=await readdir(dir); } catch(error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const records=await Promise.all(names.filter(name=>/^image-[0-9a-f-]+\.json$/.test(name)).map(async name=>{
    try { return sanitizeImageAttachments([JSON.parse(await readFile(path.join(dir,name),"utf8"))])?.[0]; } catch { return undefined; }
  }));
  return records.filter((record):record is ImageAttachment=>Boolean(record));
}
