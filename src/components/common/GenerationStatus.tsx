"use client";

import { Loader2 } from "lucide-react";
import type { AgentModule, TaskTypeId } from "@/types/learning";

type GenerationStatusProps = {
  module?: AgentModule;
  taskType?: TaskTypeId;
  hasContent?: boolean;
  stage?: string;
  completedProblems?: number;
  totalProblems?: number;
};
const stageLabels: Record<string, string> = {
  "understand-input": "Reading the request…",
  "resolve-context": "Preparing context…",
  "plan-retrieval": "Preparing retrieval…",
  "retrieve-knowledge": "Retrieving selected materials…",
  "prepare-generation": "Preparing generation…",
  generate: "Generating…",
  validate: "Checking output structure…",
  repair: "Completing missing fields…",
  commit: "Saving completed task…",
};
export function GenerationStatus({ hasContent = false, stage, completedProblems, totalProblems }: GenerationStatusProps) {
  return <div role="status" className={`flex min-h-6 items-center gap-2 text-xs text-zinc-500 ${hasContent ? "opacity-70" : ""}`} aria-live="polite">
    <Loader2 size={13} className="shrink-0 animate-spin" />
    <span>{typeof completedProblems === "number" && totalProblems ? `${completedProblems} of ${totalProblems} problems ready` : stageLabels[stage ?? ""] ?? "Generating…"}</span>
  </div>;
}
