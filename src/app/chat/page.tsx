import { Suspense } from "react";

import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-md border border-zinc-200 bg-white p-8 text-sm text-zinc-500">
          Loading Physics Learning Agent...
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
