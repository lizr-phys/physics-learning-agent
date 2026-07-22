import { constants, promises as fs } from "fs";
import path from "path";

export type DeploymentHealth = {
  ok: boolean;
  status: "ok" | "unhealthy";
  storage: "writable" | "unavailable";
  defaultModelConfigured: boolean;
  checkedAt: string;
};

function dataRoot() {
  return process.env.PLA_DATA_DIR || path.join(process.cwd(), ".pla-data");
}

export async function checkDeploymentHealth(): Promise<DeploymentHealth> {
  try {
    const root = dataRoot();
    await fs.mkdir(root, { recursive: true });
    await fs.access(root, constants.R_OK | constants.W_OK);

    return {
      ok: true,
      status: "ok",
      storage: "writable",
      defaultModelConfigured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ok: false,
      status: "unhealthy",
      storage: "unavailable",
      defaultModelConfigured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      checkedAt: new Date().toISOString(),
    };
  }
}
