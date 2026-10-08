import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addPersonalDocument,
  deletePersonalDocument,
  listPersonalDocuments,
  reindexPersonalDocument,
  retrievePersonalKnowledge,
} from "@/lib/personal-knowledge";
import * as personalKnowledge from "@/lib/personal-knowledge";

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
  it("invalidates changed and failed indexes while preserving legacy sources until explicit rebuild", async () => {
    const document = await addPersonalDocument({ userId: "rebuild-user", fileName: "my-operator.md", mimeType: "text/markdown",
      data: Buffer.from("# Green function\n\nA Green function depends on Dirichlet boundary conditions.") });
    const [first] = await retrievePersonalKnowledge("rebuild-user", "Green function");
    const metadataPath = path.join(tempDir, "users", "rebuild-user", "documents.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Array<{ id: string; storedFileName: string }>;
    const storedFile = path.resolve(tempDir, "users", "rebuild-user", "uploads", metadata.find((item) => item.id === document.id)!.storedFileName);
    expect(storedFile.startsWith(path.resolve(tempDir) + path.sep)).toBe(true);
    await writeFile(storedFile, "# Fourier transform\n\nA Fourier transform requires paired normalization conventions.");
    const rebuilt = await reindexPersonalDocument("rebuild-user", document.id);
    expect(rebuilt?.version).toBe(2);
    const [second] = await retrievePersonalKnowledge("rebuild-user", "Fourier transform");
    expect(second.sourceId).not.toBe(first.sourceId);
    expect(await personalKnowledge.getPersonalKnowledgeSource("rebuild-user", first.sourceId)).toBeNull();
    await writeFile(storedFile, Buffer.alloc(128));
    expect((await reindexPersonalDocument("rebuild-user", document.id))?.indexStatus).toBe("failed");
    expect(await retrievePersonalKnowledge("rebuild-user", "Fourier transform")).toEqual([]);
    expect(await personalKnowledge.getPersonalKnowledgeSource("rebuild-user", second.sourceId)).toBeNull();

    const legacyUser = path.join(tempDir, "users", "rebuild-user");
    await writeFile(path.join(legacyUser, "documents.json"), JSON.stringify([{ id: "legacy", userId: "rebuild-user", fileName: "old.md", indexStatus: "indexed", createdAt: 1 }]));
    await writeFile(path.join(legacyUser, "chunks.json"), JSON.stringify([{ id: "legacy:0", userId: "rebuild-user", documentId: "legacy", source: "old.md", heading: "Green function", content: "Green function and boundary conditions.", tokens: [] }]));
    expect((await personalKnowledge.getPersonalKnowledgeSource("rebuild-user", "legacy:0"))?.content).toBe("Green function and boundary conditions.");
    expect((await retrievePersonalKnowledge("rebuild-user", "Green function"))[0]?.sourceId).toBe("legacy:0");
  });
  it("returns stable source identity, original filenames and strictly authorized excerpts", async () => {
    const document = await addPersonalDocument({ userId: "account-a", fileName: "第三章 格林函数.md",
      mimeType: "text/markdown", course: "math-physics",
      data: Buffer.from("# Green functions\n\nA Green function depends on Dirichlet boundary conditions.") });
    const [source] = await retrievePersonalKnowledge("account-a", "Green function boundary");
    expect(document.fileName).toBe("第三章 格林函数.md");
    expect(document.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.version).toBe(1);
    expect(source.sourceId).toBeTruthy();
    const inspected = await personalKnowledge.getPersonalKnowledgeSource("account-a", source.sourceId);
    expect(inspected?.content).toBe(source.content);
    expect(await personalKnowledge.getPersonalKnowledgeSource("account-b", source.sourceId)).toBeNull();
    await reindexPersonalDocument("account-a", document.id);
    const [rebuilt] = await retrievePersonalKnowledge("account-a", "Green function boundary");
    expect(rebuilt.sourceId).toBe(source.sourceId);
    expect(rebuilt.metadata?.version).toBe(2);
    await deletePersonalDocument("account-a", document.id);
    expect(await personalKnowledge.getPersonalKnowledgeSource("account-a", source.sourceId)).toBeNull();
    expect(await retrievePersonalKnowledge("account-a", "Green function boundary")).toEqual([]);
  });

  it("honors explicit document and course scopes, and cancellation", async () => {
    const first = await addPersonalDocument({ userId: "scope-user", fileName: "math.md", mimeType: "text/markdown",
      course: "math-physics", data: Buffer.from("# Boundary conditions\n\nBoundary conditions fix the Green function response.") });
    await addPersonalDocument({ userId: "scope-user", fileName: "quantum.md", mimeType: "text/markdown",
      course: "quantum-mechanics", data: Buffer.from("# Boundary conditions\n\nBoundary conditions fix quantum wave functions.") });
    const scoped = await retrievePersonalKnowledge("scope-user", "boundary conditions", { documentIds: [first.id], limit: 4 });
    expect(scoped).toHaveLength(1);
    expect(scoped[0].metadata?.documentId).toBe(first.id);
    const course = await retrievePersonalKnowledge("scope-user", "boundary conditions", { course: "quantum-mechanics", courseOnly: true });
    expect(course).toHaveLength(1);
    expect(course[0].metadata?.course).toBe("quantum-mechanics");
    expect(await retrievePersonalKnowledge("other-user", "boundary conditions", { documentIds: [first.id] })).toEqual([]);
    const controller = new AbortController(); controller.abort();
    await expect(retrievePersonalKnowledge("scope-user", "boundary conditions", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    const delayed = new AbortController();
    const retrieval = retrievePersonalKnowledge("scope-user", "boundary conditions", { signal: delayed.signal });
    delayed.abort();
    await expect(retrieval).rejects.toMatchObject({ name: "AbortError" });
  });
  it("indexes text-like uploads and retrieves matching snippets", async () => {
    const document = await addPersonalDocument({
      userId: "user-1",
      fileName: "green-functions.md",
      mimeType: "text/markdown",
      description: "Mathematical methods notes",
      course: "math-physics",
      topic: "green-functions",
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
    expect(results[0]?.metadata?.course).toBe("math-physics");

    const documents = await listPersonalDocuments("user-1");
    expect(documents).toHaveLength(1);
    expect("storedFileName" in documents[0]).toBe(false);
    expect(documents[0]?.topic).toBe("green-functions");

    const reindexed = await reindexPersonalDocument("user-1", document.id);
    expect(reindexed?.indexStatus).toBe("indexed");
    expect(reindexed?.chunkCount).toBeGreaterThan(0);

    expect(await deletePersonalDocument("user-1", document.id)).toBe(true);
    expect(await listPersonalDocuments("user-1")).toHaveLength(0);
  });

  it("preserves concurrent uploads for the same user", async () => {
    await Promise.all(
      ["lagrange.md", "hamilton.md", "oscillations.md"].map((fileName) =>
        addPersonalDocument({
          userId: "user-concurrent",
          fileName,
          mimeType: "text/markdown",
          course: "theoretical-mechanics",
          data: Buffer.from(`# ${fileName}\n\nCanonical mechanics notes for ${fileName}.`, "utf8"),
        }),
      ),
    );

    const documents = await listPersonalDocuments("user-concurrent");
    expect(documents).toHaveLength(3);
    expect(new Set(documents.map((document) => document.fileName))).toEqual(
      new Set(["lagrange.md", "hamilton.md", "oscillations.md"]),
    );
  });
});
