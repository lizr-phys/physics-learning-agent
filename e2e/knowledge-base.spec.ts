import { expect, test } from "@playwright/test";

test("personal documents preserve metadata, retrieve chunks, and reindex", async ({
  request,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name.replace(/\W+/g, "-")}`;
  const registerResponse = await request.post("/api/auth/register", {
    data: {
      name: "Knowledge Base Student",
      email: `kb-${suffix}@example.com`,
      password: "Physics123",
    },
  });

  expect(registerResponse.ok()).toBe(true);

  const uploadResponse = await request.post("/api/knowledge/documents", {
    multipart: {
      file: {
        name: "hamilton-notes.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(
          "# Hamiltonian mechanics\n\nCanonical coordinates and momenta satisfy Hamilton's equations.",
        ),
      },
      description: "Personal mechanics notes",
      course: "theoretical-mechanics",
      topic: "hamilton-equations",
    },
  });
  const uploadBody = await uploadResponse.json();

  expect(uploadResponse.ok()).toBe(true);
  expect(uploadBody.document.indexStatus).toBe("indexed");
  expect(uploadBody.document.course).toBe("theoretical-mechanics");
  expect(uploadBody.document.topic).toBe("hamilton-equations");
  expect(uploadBody.document.chunkCount).toBeGreaterThan(0);

  const reindexResponse = await request.patch(
    `/api/knowledge/documents/${encodeURIComponent(uploadBody.document.id)}`,
  );
  const reindexBody = await reindexResponse.json();

  expect(reindexResponse.ok()).toBe(true);
  expect(reindexBody.document.indexStatus).toBe("indexed");
  expect(reindexBody.document.chunkCount).toBeGreaterThan(0);

  const listResponse = await request.get("/api/knowledge/documents");
  const listBody = await listResponse.json();

  expect(listResponse.ok()).toBe(true);
  expect(listBody.documents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: uploadBody.document.id,
        sourceType: "md",
        extractionMethod: "langchain-text",
      }),
    ]),
  );

  const deleteResponse = await request.delete(
    `/api/knowledge/documents/${encodeURIComponent(uploadBody.document.id)}`,
  );
  expect(deleteResponse.ok()).toBe(true);
});
