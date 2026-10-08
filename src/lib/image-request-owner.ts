import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-server";
import { ImageInputError } from "@/lib/image-store";
const guestCookie = "pla_guest_images";
function guestOwner(token?: string) { return token && /^[0-9a-f]{64}$/.test(token) ? `guest:${createHash("sha256").update(token).digest("hex")}` : undefined; }
export async function imageRequestOwner(request: NextRequest, createGuest = false) {
  const user = await getUserFromRequest(request);
  const expected = request.headers.get("X-PLA-Workspace-Owner");
  if (expected && expected !== (user?.id ?? "guest")) throw new ImageInputError("The signed-in account changed. Retry in the current workspace.",409,"WORKSPACE_OWNER_CHANGED");
  const provided = request.headers.get("X-PLA-Guest-Media-Token");
  let token = provided && /^[0-9a-f]{64}$/.test(provided) ? provided : request.cookies.get(guestCookie)?.value;
  let newCookie: string | undefined;
  if (!user && !guestOwner(token) && createGuest) { token = randomBytes(32).toString("hex"); newCookie = token; }
  else if (!user && createGuest && token !== request.cookies.get(guestCookie)?.value) newCookie = token;
  return {user,owner:user ? `account:${user.id}` : guestOwner(token),guestOwner:guestOwner(token),newCookie};
}
export function setGuestImageCookie(response: NextResponse, token?: string) {
  if (token) response.cookies.set(guestCookie,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV === "production",path:"/",maxAge:365*24*60*60});
}
