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
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]') ?? [])
      .filter(item => item.tabIndex >= 0 && !item.matches(":disabled") && item.getClientRects().length > 0);
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); setSidebarOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusable(); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeAtDesktop = () => { if (desktop.matches) setSidebarOpen(false); };
    document.addEventListener("keydown", keydown);
    desktop.addEventListener("change", closeAtDesktop);
    return () => {
      document.removeEventListener("keydown", keydown);
      desktop.removeEventListener("change", closeAtDesktop);
      if (opener?.getClientRects().length) opener.focus();
      else if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [sidebarOpen]);

  return (
    <UserDataSync><div className="flex h-full overflow-hidden bg-white text-[#111111]">
      <div className="hidden h-full md:block">
        <Sidebar />
      </div>

      {sidebarOpen ? (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-0 z-40 md:hidden">
          <div
            className="navigation-backdrop absolute inset-0 bg-black/20"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="navigation-drawer relative h-full w-fit max-w-full">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={sidebarOpen}>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 px-4 md:hidden">
          <button
            type="button"
            ref={openButtonRef}
            aria-label="Open sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-study-800 hover:bg-study-50"
          >
            <Menu size={18} />
          </button>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
            <Image src="/logo.png" alt="Physics Learning Agent logo" width={20} height={20} className="object-contain" />
          </span>
          <span className="min-w-0 truncate text-sm font-semibold">Physics Learning Agent</span>
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
