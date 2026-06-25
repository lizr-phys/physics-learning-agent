"use client";

import { ChevronDown, MessageSquare } from "lucide-react";
import { useState } from "react";

import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import { StudyActions } from "@/components/common/StudyActions";
import type { ParsedPracticeProblem } from "@/lib/practice-parser";

type PracticeProblemCardProps = {
  problem: ParsedPracticeProblem;
  onAsk: (problem: ParsedPracticeProblem) => void;
  course?: string;
  knowledgeTitle?: string;
  headingId?: string;
};

function FoldSection({ title, content }: { title: string; content?: string }) {
  if (!content) {
    return null;
  }

  return (
    <details className="group border-t border-zinc-200 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-zinc-800">
        {title}
        <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">
        <MarkdownRenderer content={content} />
      </div>
    </details>
  );
}

export function PracticeProblemCard({
  problem,
  onAsk,
  course,
  knowledgeTitle,
  headingId,
}: PracticeProblemCardProps) {
  const [problemOpen, setProblemOpen] = useState(true);

  return (
    <article
      id={headingId}
      className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white"
    >
      <button
        type="button"
        onClick={() => setProblemOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left hover:bg-zinc-50"
      >
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-950">{problem.title}</h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {problem.knowledge ? <span>知识点：{problem.knowledge}</span> : null}
            {problem.difficulty ? <span>难度：{problem.difficulty}</span> : null}
          </div>
        </div>
        <ChevronDown
          size={17}
          className={`mt-1 shrink-0 transition-transform ${problemOpen ? "rotate-180" : ""}`}
        />
      </button>

      {problemOpen ? (
        <div className="px-4 pb-4">
          {problem.trainingGoal ? (
            <p className="mb-3 text-xs leading-5 text-zinc-500">
              训练目标：{problem.trainingGoal}
            </p>
          ) : null}
          <div className="rounded-md bg-zinc-50 p-3">
            <MarkdownRenderer content={problem.problem} />
          </div>
          <div className="mt-3">
            <FoldSection title="显示提示" content={problem.hint} />
            <FoldSection title="显示解析" content={problem.solution} />
            <FoldSection title="显示答案" content={problem.answer} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3">
            <button
              type="button"
              onClick={() => onAsk(problem)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              <MessageSquare size={13} />
              追问本题
            </button>
            <StudyActions
              title={problem.title}
              content={problem.rawContent}
              source="practice"
              type="problem"
              course={course}
              knowledgeTitle={knowledgeTitle}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}
