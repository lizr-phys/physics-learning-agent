import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addPersonalDocument,
  deletePersonalDocument,
  listPersonalDocuments,
  retrievePersonalKnowledge,
} from "@/lib/personal-knowledge";

let tempDir = "";
let previousDataDir: string | undefined;

beforeEach(async () => {
  previousDataDir = process.env.PLA_DATA_DIR;
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pla-kb-"));
  process.env.PLA_DATA_DIR = tempDir;
});

afterEach(async () => {
  process.env.PLA_DATA_DIR = previousDataDir;
  await rm(tempDir, { recursive: true, force: true });
});

describe("personal knowledge base", () => {
  it("indexes text-like uploads and retrieves matching snippets", async () => {
    const document = await addPersonalDocument({
      userId: "user-1",
      fileName: "green-functions.md",
      mimeType: "text/markdown",
      description: "Mathematical methods notes",
      data: Buffer.from(
        [
          "# Green functions",
          "",
          "A Green function is determined by a linear operator and boundary conditions.",
          "For Poisson problems, the boundary condition controls the admissible response.",
        ].join("\n"),
        "utf8",
      ),
    });

    expect(document.indexStatus).toBe("indexed");
    expect(document.chunkCount).toBeGreaterThan(0);

    const results = await retrievePersonalKnowledge("user-1", "boundary Green function", 2);

    expect(results[0]?.source).toContain("green-functions.md");
    expect(results[0]?.content).toContain("boundary conditions");

    const documents = await listPersonalDocuments("user-1");
    expect(documents).toHaveLength(1);
    expect("storedFileName" in documents[0]).toBe(false);

    expect(await deletePersonalDocument("user-1", document.id)).toBe(true);
    expect(await listPersonalDocuments("user-1")).toHaveLength(0);
  });
});
