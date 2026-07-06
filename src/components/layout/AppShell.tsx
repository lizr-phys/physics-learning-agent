"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { UserDataSync } from "@/components/layout/UserDataSync";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isChatWorkspace = pathname === "/" || pathname === "/chat";

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <UserDataSync />
      <div className="hidden h-full md:block">
        <Sidebar />
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            aria-label="Close sidebar overlay"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-700 shadow-sm"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 px-4 md:hidden">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-700"
          >
            <Menu size={18} />
          </button>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
            <Image src="/logo.png" alt="Physics Learning Agent logo" width={20} height={20} className="object-contain" />
          </span>
          <span className="text-sm font-semibold">Physics Learning Agent</span>
        </header>

        <main
          className={
            isChatWorkspace
              ? "min-h-0 min-w-0 flex-1 overflow-hidden"
              : "min-h-0 min-w-0 flex-1 overflow-y-auto"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
