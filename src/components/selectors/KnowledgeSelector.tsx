"use client";

import { memo, useMemo } from "react";

import { getKnowledgeByCourse } from "@/data/knowledge";
import type { CourseId } from "@/types/learning";

type KnowledgeSelectorProps = {
  course: CourseId;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export const KnowledgeSelector = memo(function KnowledgeSelector({
  course,
  value,
  onChange,
  compact = false,
}: KnowledgeSelectorProps) {
  const knowledgeOptions = useMemo(() => getKnowledgeByCourse(course), [course]);

  return (
    <label className={compact ? "block" : "block space-y-2 text-sm font-medium text-zinc-800"}>
      {!compact ? <span>知识点</span> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          compact
            ? "h-9 rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none hover:border-zinc-400 focus:border-zinc-500"
            : "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
        }
      >
        <option value="">未指定知识点</option>
        {knowledgeOptions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </label>
  );
});
