"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Popover({ label, trigger, children, align = "start", side = "bottom", anchorToParent = false, closeOnAction = false, triggerClassName = "", panelClassName = "" }: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  anchorToParent?: boolean;
  closeOnAction?: boolean;
  triggerClassName?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open]);

  return <div ref={root} className={`${anchorToParent ? "" : "relative"} inline-flex shrink-0`} onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={button} type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className={triggerClassName}>{trigger}</button>
    {open ? <div id={id} role="group" aria-label={label} className={`absolute z-40 max-h-[60dvh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-white p-4 text-sm text-zinc-700 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.2)] ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${align === "end" ? "right-0" : "left-0"} ${panelClassName}`} onClick={event => {
      if (closeOnAction && event.target instanceof Element && event.target.closest("button")) { setOpen(false); button.current?.focus(); }
    }}>{children}</div> : null}
  </div>;
}
