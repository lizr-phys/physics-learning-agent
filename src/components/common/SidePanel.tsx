"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function SidePanel({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => {
    if (busy) return;
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }} className="material-panel fixed inset-0 m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-white p-0 text-zinc-950 backdrop:bg-zinc-950/25">
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label={`Close ${title}`} className="flex size-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"><X size={18} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  </dialog>;
}
