export type SseFrame = { event: string; data: string; comment: boolean };

function frameFromText(text: string): SseFrame {
  let event = "message";
  const data: string[] = [];
  let comment = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(":")) { comment = true; continue; }
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  return { event, data: data.join("\n"), comment };
}

/** Incremental SSE framing, including fragmented CRLF and multiline data fields. */
export class SseDecoder {
  private buffer = "";
  push(text: string): SseFrame[] {
    this.buffer += text;
    const frames: SseFrame[] = [];
    let boundary: RegExpExecArray | null;
    while ((boundary = /\r?\n\r?\n/.exec(this.buffer))) {
      frames.push(frameFromText(this.buffer.slice(0, boundary.index)));
      this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
    }
    return frames;
  }
  finish() {
    const partial = this.buffer.trim() ? frameFromText(this.buffer) : undefined;
    this.buffer = "";
    return partial;
  }
}
