import { describe, expect, it, vi } from "vitest";

import { readFormDataRequest, readJsonRequest, RequestBodyError } from "@/lib/request-body";

describe("request body reader", () => {
  it("cancels an over-limit stream without waiting for the producer to close", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(33)); },
      cancel,
    });
    // Model the inbound platform stream directly rather than wrapping an
    // outgoing fetch body in Node's Request constructor.
    const request = { headers: new Headers(), body } as Request;
    await expect(readJsonRequest(request, 32)).rejects.toMatchObject({ status: 413, code: "body-too-large" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("reads allowed multipart documents and rejects over-limit multipart bodies", async () => {
    const fields = new FormData();
    fields.set("file", new File(["# Fourier notes"], "notes.md", { type: "text/markdown" }));
    const encoded = new Response(fields);
    const bytes = await encoded.arrayBuffer();
    const request = () => new Request("https://example.test/api", { method: "POST", headers: encoded.headers, body: bytes });
    const result = await readFormDataRequest(request(), 1024);
    expect(await (result.get("file") as File).text()).toBe("# Fourier notes");
    await expect(readFormDataRequest(request(), 16)).rejects.toMatchObject({ status: 413 });
  });

  it("parses JSON within the configured byte limit", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      body: JSON.stringify({ message: "boundary conditions" }),
    });

    await expect(readJsonRequest(request, 1024)).resolves.toEqual({
      message: "boundary conditions",
    });
  });

  it("rejects malformed and oversized JSON bodies with explicit errors", async () => {
    const invalid = new Request("https://example.test/api", {
      method: "POST",
      body: "{invalid",
    });
    const oversized = new Request("https://example.test/api", {
      method: "POST",
      body: JSON.stringify({ message: "x".repeat(200) }),
    });

    await expect(readJsonRequest(invalid, 1024)).rejects.toMatchObject({
      code: "invalid-json",
      status: 400,
    } satisfies Partial<RequestBodyError>);
    await expect(readJsonRequest(oversized, 32)).rejects.toMatchObject({
      code: "body-too-large",
      status: 413,
    } satisfies Partial<RequestBodyError>);
  });
});
