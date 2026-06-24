import { Suspense } from "react";

import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          正在加载学习工作台...
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
