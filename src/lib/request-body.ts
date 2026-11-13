export class RequestBodyError extends Error {
  constructor(
    message: string,
    public status: 400 | 413,
    public code: "invalid-json" | "invalid-form" | "body-too-large",
  ) {
    super(message);
  }
}

function tooLarge() {
  return new RequestBodyError("The request body is too large.", 413, "body-too-large");
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw tooLarge();
  }

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      parts.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  return body;
}

export async function readJsonRequest<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const body = await readBoundedBody(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new RequestBodyError("The request body is not valid JSON.", 400, "invalid-json");
  }
}

export async function readFormDataRequest(request: Request, maxBytes: number): Promise<FormData> {
  const body = await readBoundedBody(request, maxBytes);
  try {
    return await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    throw new RequestBodyError("This upload could not be read. Choose the file again and retry.", 400, "invalid-form");
  }
}
