"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { AgentModule, TaskTypeId } from "@/types/learning";

const stages: Record<string, string[]> = {
  practice: ["Building problem conditions...", "Generating hints and solutions...", "Checking formula format..."],
  derivation: ["Checking assumptions...", "Writing derivation steps...", "Checking notation consistency..."],
  chat: ["Organizing the answer...", "Adding necessary explanation...", "Checking notation and formulas..."],
};

type GenerationStatusProps = {
  module?: AgentModule;
  taskType?: TaskTypeId;
  hasContent?: boolean;
};

export function GenerationStatus({
  module = "chat",
  taskType,
  hasContent = false,
}: GenerationStatusProps) {
  const key = taskType === "derivation" ? "derivation" : module;
  const labels = stages[key] ?? stages.chat;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % labels.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [labels.length]);

  return (
    <div
      className={`flex min-h-6 items-center gap-2 text-xs text-zinc-500 ${
        hasContent ? "opacity-70" : ""
      }`}
      aria-live="polite"
    >
      <Loader2 size={13} className="shrink-0 animate-spin" />
      <span>{labels[index]}</span>
    </div>
  );
}
