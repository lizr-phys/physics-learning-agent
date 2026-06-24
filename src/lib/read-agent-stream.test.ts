import { describe, expect, it } from "vitest";

import { AgentStreamError, readAgentStream } from "@/lib/read-agent-stream";

function responseFromChunks(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe("readAgentStream", () => {
  it("assembles fragmented text and stream-control events", async () => {
    const updates: string[] = [];
    const response = responseFromChunks([
      "第一",
      "段\n[[PLA_STREAM_",
      "EVENT:done]]\n",
    ]);

    await expect(
      readAgentStream(response, (content) => updates.push(content)),
    ).resolves.toBe("第一段\n");
    expect(updates.at(-1)).toBe("第一段\n");
  });

  it("preserves partial content when the upstream stream ends abnormally", async () => {
    const response = responseFromChunks([
      "已生成内容",
      "\n[[PLA_STREAM_EVENT:error:%E4%B8%8A%E6%B8%B8%E4%B8%AD%E6%96%AD]]\n",
    ]);

    await expect(readAgentStream(response, () => undefined)).rejects.toMatchObject({
      reason: "network",
      partialContent: "已生成内容\n",
    } satisfies Partial<AgentStreamError>);
  });
});
