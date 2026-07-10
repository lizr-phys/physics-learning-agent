import { describe, expect, it } from "vitest";

import { readJsonRequest, RequestBodyError } from "@/lib/request-body";

describe("request body reader", () => {
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
