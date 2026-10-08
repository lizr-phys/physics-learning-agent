import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import sharp from "sharp";
vi.mock("server-only",()=>({}));
import {listStoredImages,readStoredImage,resolveRequestImages,storeImage,removeStoredImage} from "@/lib/image-store";
import {IMAGE_LIMITS} from "@/lib/image-attachments";
let directory:string;
beforeEach(async()=>{directory=await mkdtemp(path.join(tmpdir(),"pla-image-store-"));vi.stubEnv("PLA_DATA_DIR",directory);});
afterEach(async()=>{vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true});});
const png=()=>sharp({create:{width:40,height:30,channels:3,background:"white"}}).png().toBuffer();
describe("private vision image storage",()=>{
  it("normalizes a real image and resolves it only for the owning account",async()=>{
    const image=await storeImage("account:a",await png(),"diagram.png");
    expect(image).toMatchObject({mimeType:"image/webp",width:40,height:30,name:"diagram.png"});
    const stored=await readStoredImage("account:a",image.id);
    expect((await sharp(stored.data).metadata()).format).toBe("webp");
    expect(await resolveRequestImages({message:"Explain the diagram",images:[image]},"account:a")).toHaveProperty(image.id);
    await expect(readStoredImage("account:b",image.id)).rejects.toMatchObject({status:404});
    expect(await listStoredImages("account:b")).toEqual([]);
  });
  it("rejects active SVG, non-image files and oversized input before storage",async()=>{
    await expect(storeImage("guest:a",Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),"diagram.png")).rejects.toMatchObject({status:400});
    await expect(storeImage("guest:a",Buffer.from("not an image"),"photo.jpg")).rejects.toMatchObject({status:400});
    await expect(storeImage("guest:a",Buffer.alloc(IMAGE_LIMITS.uploadBytes+1),"large.png")).rejects.toMatchObject({status:413});
    expect(await listStoredImages("guest:a")).toEqual([]);
  });
  it("never resolves another workspace's history or client-controlled paths",async()=>{
    const image=await storeImage("account:a",await png(),"given.png");
    await expect(resolveRequestImages({message:"Continue",history:[{role:"user",content:"Question",images:[image]}]},"account:b")).rejects.toMatchObject({status:404});
    await expect(readStoredImage("account:a","../../users.json")).rejects.toMatchObject({status:404});
    expect(await listStoredImages("account:a")).toHaveLength(1);
  });
  it("removes only the explicitly selected owned image",async()=>{
    const image=await storeImage("account:a",await png(),"a.png");
    const other=await storeImage("account:b",await png(),"b.png");
    await removeStoredImage("account:a",image.id);
    expect(await listStoredImages("account:a")).toEqual([]);
    expect((await listStoredImages("account:b"))[0].id).toBe(other.id);
  });
});
