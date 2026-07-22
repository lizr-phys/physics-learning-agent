import { NextResponse } from "next/server";

import { checkDeploymentHealth } from "@/lib/deployment-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkDeploymentHealth();

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
