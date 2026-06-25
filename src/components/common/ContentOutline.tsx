"use client";

import { List } from "lucide-react";
import { useMemo } from "react";

import { extractContentOutline } from "@/lib/content-outline";

type ContentOutlineProps = {
  content: string;
  minimumItems?: number;
};

export function ContentOutline({ content, minimumItems = 3 }: ContentOutlineProps) {
  const items = useMemo(() => extractContentOutline(content), [content]);

  if (items.length < minimumItems) {
    return null;
  }

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const links = (
    <nav className="space-y-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => goTo(item.id)}
          className={`block w-full text-left text-xs leading-5 text-zinc-600 hover:text-zinc-950 ${
            item.level === 3 ? "pl-3" : ""
          }`}
        >
          {item.title}
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-zinc-800">
          <List size={15} />
          目录
        </summary>
        <div className="mt-3 border-t border-zinc-200 pt-3">{links}</div>
      </details>
      <aside className="hidden rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:block">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-800">
          <List size={15} />
          目录
        </div>
        {links}
      </aside>
    </>
  );
}
