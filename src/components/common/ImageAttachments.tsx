"use client";
import Image from "next/image";
import { useEffect,useEffectEvent,useRef,useState } from "react";
import { Camera,Paperclip,X } from "lucide-react";
import { IMAGE_LIMITS,imageUrl } from "@/lib/image-attachments";
import { uploadImage } from "@/lib/image-client";
import { getWorkspaceIdentity,isWorkspaceCurrent } from "@/lib/workspace-storage";
import type { ImageAttachment } from "@/types/learning";

export function ImageGallery({images,compact=false}:{images?:ImageAttachment[];compact?:boolean}) {
  return images?.length ? <div className="flex flex-wrap gap-2" data-testid="message-images">{images.map(image=><a key={image.id} href={imageUrl(image)} target="_blank" rel="noopener noreferrer" aria-label={`View image: ${image.name}`} className={`relative block overflow-hidden rounded-lg border border-zinc-200 ${compact ? "h-16 w-20" : "max-w-64"}`}>
    <Image unoptimized src={imageUrl(image)} {...(compact ? {fill:true,sizes:"80px"} : {width:image.width,height:image.height})} alt={image.name} className={compact ? "object-contain" : "max-h-48 h-auto w-auto max-w-64 object-contain"} />
  </a>)}</div> : null;
}
export function ImageAttachmentInput({images,onChange,onBusyChange,disabled=false,pasteTargetId}:{images:ImageAttachment[];onChange:(images:ImageAttachment[])=>void;onBusyChange:(busy:boolean)=>void;disabled?:boolean;pasteTargetId?:string}) {
  const inputRef=useRef<HTMLInputElement>(null),cameraRef=useRef<HTMLInputElement>(null),controllerRef=useRef<AbortController>(null);
  const aliveRef=useRef(true),busyRef=useRef(false),imagesRef=useRef(images);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(() => { imagesRef.current = images; }, [images]);
  async function add(files:File[]) {
    if (disabled || busyRef.current || !files.length) return;
    if (files.length+imagesRef.current.length>IMAGE_LIMITS.perMessage) {setError("Attach up to four images.");return;}
    const identity=getWorkspaceIdentity(),controller=new AbortController();controllerRef.current=controller;
    busyRef.current=true;setBusy(true);onBusyChange(true);setError("");
    let next=imagesRef.current;
    try {
      for (const file of files) {
        const image=await uploadImage(file,controller.signal);
        if (!aliveRef.current || !isWorkspaceCurrent(identity)) return;
        next=[...next,image];imagesRef.current=next;onChange(next);
      }
    } catch(error) {if (aliveRef.current && isWorkspaceCurrent(identity) && !controller.signal.aborted) setError(error instanceof Error ? error.message : "Image upload failed.");}
    finally {if (aliveRef.current && isWorkspaceCurrent(identity)) {busyRef.current=false;setBusy(false);onBusyChange(false);}}
  }
  const uploadFromPaste=useEffectEvent((files:File[])=>{void add(files);});
  useEffect(()=>{
    aliveRef.current=true;
    const paste=(event:globalThis.ClipboardEvent)=>{
      if (pasteTargetId && (event.target as HTMLElement)?.id !== pasteTargetId) return;
      const files=Array.from(event.clipboardData?.items ?? []).filter(item=>item.kind==="file" && item.type.startsWith("image/")).map(item=>item.getAsFile()).filter((file):file is File=>Boolean(file));
      if (files.length) {event.preventDefault();uploadFromPaste(files);}
    };
    const abort=()=>controllerRef.current?.abort();
    document.addEventListener("paste",paste);window.addEventListener("pla:workspace-will-change",abort);
    return()=>{aliveRef.current=false;abort();document.removeEventListener("paste",paste);window.removeEventListener("pla:workspace-will-change",abort);};
  },[pasteTargetId]);
  return <div className="space-y-2">
    {images.length ? <div className="flex flex-wrap gap-2">{images.map(image=><div key={image.id} className="relative">
      <ImageGallery images={[image]} compact />
      <button type="button" disabled={disabled || busy} onClick={()=>onChange(images.filter(current=>current.id!==image.id))} aria-label={`Remove image: ${image.name}`} className="absolute -right-1 -top-1 rounded-full bg-white p-1 text-zinc-600 shadow-sm"><X size={12}/></button>
    </div>)}</div> : null}
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <button type="button" disabled={disabled || busy || images.length>=IMAGE_LIMITS.perMessage} onClick={()=>inputRef.current?.click()} aria-label="Attach images" className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 hover:bg-zinc-100 disabled:opacity-40"><Paperclip size={16}/>{busy ? "Uploading…" : "Image"}</button>
      <button type="button" disabled={disabled || busy || images.length>=IMAGE_LIMITS.perMessage} onClick={()=>cameraRef.current?.click()} aria-label="Take photo" className="rounded-md p-2 hover:bg-zinc-100 disabled:opacity-40"><Camera size={16}/></button>
      {images.length ? <span>Sent to your selected model.</span> : null}
    </div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden data-testid="image-upload" onChange={event=>{void add(Array.from(event.target.files ?? []));event.target.value="";}}/>
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden data-testid="camera-upload" onChange={event=>{void add(Array.from(event.target.files ?? []));event.target.value="";}}/>
    {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
  </div>;
}
