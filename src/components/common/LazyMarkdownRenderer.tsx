"use client";
import dynamic from "next/dynamic";
import type { MarkdownRendererProps } from "@/components/common/MarkdownRenderer";

export const MarkdownRenderer = dynamic<MarkdownRendererProps>(
  () => import("@/components/common/MarkdownRenderer").then(module => module.MarkdownRenderer),
  { loading: () => <p className="text-sm text-zinc-500">Rendering content…</p> },
);
