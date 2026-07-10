export class RequestBodyError extends Error {
  constructor(
    message: string,
    public status: 400 | 413,
    public code: "invalid-json" | "body-too-large",
  ) {
    super(message);
  }
}

export async function readJsonRequest<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError("The request body is too large.", 413, "body-too-large");
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new RequestBodyError("The request body is too large.", 413, "body-too-large");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestBodyError("The request body is not valid JSON.", 400, "invalid-json");
  }
}
