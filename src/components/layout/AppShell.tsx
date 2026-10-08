"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { UserDataSync } from "@/components/layout/UserDataSync";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const isChatWorkspace = pathname === "/" || pathname === "/chat";

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const opener = openButtonRef.current;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [tabindex="0"]') ?? []).filter(item => item.getClientRects().length > 0);
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setSidebarOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusable(); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      (previousFocus?.isConnected ? previousFocus : opener)?.focus();
    };
  }, [sidebarOpen]);

  return (
    <UserDataSync><div className="flex h-[100dvh] overflow-hidden bg-white text-[#111111]">
      <div className="hidden h-full md:block">
        <Sidebar />
      </div>

      {sidebarOpen ? (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-0 z-40 md:hidden">
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
            ref={openButtonRef}
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
    </div></UserDataSync>
  );
}
