import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {openProviderEventStream} from "@/lib/deepseek";
import {allocateRequestContext} from "@/agent/context-manager";
import {safePracticeRequest} from "@/lib/practice-task";
import {sanitizeUserDataSnapshot} from "@/lib/user-data-server";
import type {AgentRequest,ImageAttachment,ClientProviderKind} from "@/types/learning";
const image:ImageAttachment={id:"image-00000000-0000-4000-8000-000000000001",name:"diagram.png",mimeType:"image/webp",width:40,height:30,size:100};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("multimodal provider transport",()=>{
  it.each(["openai-compatible","anthropic","gemini"] as ClientProviderKind[])("sends original and current images through %s content parts",async type=>{
    let payload:Record<string,unknown>={};
    vi.stubEnv("DEEPSEEK_API_KEY","synthetic-key");
    vi.stubGlobal("fetch",vi.fn(async (_url,init)=>{payload=JSON.parse(init.body);return new Response("data: [DONE]\n\n");}));
    const input:AgentRequest={message:"Explain these axes",model:"deepseek-flash",images:[image],history:[{role:"user",content:"First diagram",images:[image]}],resolvedImages:{[image.id]:{mimeType:"image/webp",data:"SYNTHETIC_IMAGE"}},
      clientProvider:type==="openai-compatible" ? undefined : {provider:type==="anthropic" ? "anthropic" : "gemini",type,model:"synthetic-vision-model",apiKey:"synthetic-key"}};
    const events=await openProviderEventStream(input);await events.return(undefined);
    const encoded=JSON.stringify(payload);
    expect(encoded).toContain("SYNTHETIC_IMAGE");
    expect(encoded.match(/SYNTHETIC_IMAGE/g)).toHaveLength(1);
    expect(encoded).not.toContain(image.id);
    if(type==="openai-compatible") {expect(payload.model).toBe("deepseek-flash");expect(encoded).toContain('"type":"image_url"');}
    if(type==="anthropic") expect(encoded).toContain('"media_type":"image/webp"');
    if(type==="gemini") expect(encoded).toContain('"inlineData"');
  });
  it("refuses text-only DeepSeek instead of dropping the image",async()=>{
    vi.stubEnv("DEEPSEEK_API_KEY","synthetic-key");const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
    await expect(openProviderEventStream({message:"Explain",model:"deepseek-v4-pro",images:[image],resolvedImages:{[image.id]:{mimeType:"image/webp",data:"synthetic"}}})).rejects.toMatchObject({code:"invalid-provider"});
    expect(fetch).not.toHaveBeenCalled();
  });
  it("budgets visual history, keeps the newest images and reports omitted images",()=>{
    const history=Array.from({length:10},(_,index)=>({role:"user" as const,id:String(index),content:`Question ${index}`,images:[{...image,id:`image-00000000-0000-4000-8000-${String(index+2).padStart(12,"0")}`}]}));
    const input=allocateRequestContext({message:"Explain this new diagram",images:[image],history});
    const selected=input.history!.flatMap(message=>message.images ?? []);
    expect(selected).toHaveLength(7);
    expect(selected.at(-1)?.id).toBe(history.at(-1)?.images[0].id);
    expect(input.history?.some(message=>message.content.includes("Earlier images omitted"))).toBe(true);
    expect(input.contextBudget!.estimatedTokens).toBeGreaterThanOrEqual(8*1024);
  });
  it("persists references and safe practice parameters without image bytes or provider keys",()=>{
    const original=safePracticeRequest({message:"Generate variants",images:[image],resolvedImages:{[image.id]:{mimeType:"image/webp",data:"private-image-bytes"}},clientProvider:{provider:"deepseek",type:"openai-compatible",model:"deepseek-flash",apiKey:"secret"}});
    expect(original.images?.[0].id).toBe(image.id);
    expect(JSON.stringify(original)).not.toMatch(/secret|private-image-bytes/);
    const snapshot=sanitizeUserDataSnapshot({sessions:[{id:"s",title:"Image question",messages:[{role:"user",content:"Question",images:[image]}]}],practiceHistory:[{id:"p",title:"Practice",content:"partial",prompt:"variants",status:"interrupted",originalRequest:original}]});
    expect(snapshot.sessions[0]).toMatchObject({messages:[{images:[{id:image.id}]}]});
    expect((snapshot.practiceHistory[0].originalRequest as AgentRequest)?.images?.[0].id).toBe(image.id);
  });
});
