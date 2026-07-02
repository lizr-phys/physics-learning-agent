import { Suspense } from "react";

import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          Loading learning workspace...
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
