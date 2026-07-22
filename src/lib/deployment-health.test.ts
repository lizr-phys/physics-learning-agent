import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkDeploymentHealth } from "@/lib/deployment-health";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("deployment health", () => {
  it("reports writable persistent storage without exposing its path", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "pla-health-"));
    const dataDirectory = path.join(parent, "data");
    temporaryDirectories.push(parent);
    vi.stubEnv("PLA_DATA_DIR", dataDirectory);
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");

    const result = await checkDeploymentHealth();

    expect(result).toMatchObject({
      ok: true,
      status: "ok",
      storage: "writable",
      defaultModelConfigured: true,
    });
    expect(result).not.toHaveProperty("dataRoot");
  });
});
