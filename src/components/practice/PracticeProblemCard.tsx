"use client";

import { CheckCircle2, ChevronDown, CircleHelp, MessageSquare } from "lucide-react";
import { useState } from "react";

import { MarkdownRenderer } from "@/components/common/LazyMarkdownRenderer";
import type { ParsedPracticeProblem } from "@/lib/practice-parser";
import { validatePracticeProblem } from "@/lib/practice-parser";
import type { PracticeAssessment, PracticeAssessmentStatus, PracticeOutputMode } from "@/types/learning";

type PracticeProblemCardProps = {
  problem: ParsedPracticeProblem;
  onAsk: (problem: ParsedPracticeProblem) => void;
  assessment?: PracticeAssessment;
  onAssess: (problemId: number | string, status?: PracticeAssessmentStatus, notes?: { attemptDraft?: string; stuckNote?: string }) => void;
  outputMode?: PracticeOutputMode;
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
  assessment,
  onAssess,
  headingId,
  outputMode = "hidden-answer",
}: PracticeProblemCardProps) {
  const [problemOpen, setProblemOpen] = useState(true);
  const [attemptDraft, setAttemptDraft] = useState(assessment?.attemptDraft ?? "");
  const [stuckNote, setStuckNote] = useState(assessment?.stuckNote ?? "");
  const notes = { attemptDraft, stuckNote };
  const assessmentStatus = assessment?.status;

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
            {problem.knowledge ? <span>Topics: {problem.knowledge}</span> : null}
            {problem.difficulty ? <span>Difficulty: {problem.difficulty}</span> : null}
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
              Training goal: {problem.trainingGoal}
            </p>
          ) : null}
          <div className="rounded-md bg-zinc-50 p-3">
            {problem.conditions ? <div className="mb-3"><p className="mb-1 text-xs font-medium text-zinc-500">Conditions</p><MarkdownRenderer content={problem.conditions} /></div> : null}
            <MarkdownRenderer content={problem.problem} />
          </div>
          {!validatePracticeProblem(problem, outputMode).valid ? <p className="mt-2 text-xs text-amber-700">This problem needs structural completion. Generated answers still require physics review.</p> : null}
          <div className="mt-3">
            <FoldSection title="Show hint" content={problem.hint} />
            <FoldSection title="Show solution" content={problem.solution} />
            <FoldSection title="Show answer" content={problem.answer} />
            <FoldSection title="Show common mistakes" content={problem.pitfalls} />
          </div>
          <details className="border-t border-zinc-200 py-3">
            <summary className="cursor-pointer text-xs font-medium text-zinc-700">My attempt (optional)</summary>
            <label className="mt-3 block text-xs text-zinc-600">Your working
              <textarea aria-label={`Your attempt for problem ${problem.index}`} value={attemptDraft} maxLength={4000} onChange={event => setAttemptDraft(event.target.value)} onBlur={() => { if (assessmentStatus) onAssess(problem.id, assessmentStatus, notes); }} className="mt-1 block min-h-20 w-full rounded border border-zinc-200 p-2 text-sm" />
            </label>
            <label className="mt-2 block text-xs text-zinc-600">Where did you get stuck?
              <input aria-label={`Stuck step for problem ${problem.index}`} value={stuckNote} maxLength={1000} onChange={event => setStuckNote(event.target.value)} onBlur={() => { if (assessmentStatus) onAssess(problem.id, assessmentStatus, notes); }} className="mt-1 block w-full rounded border border-zinc-200 p-2 text-sm" />
            </label>
            <p className="mt-2 text-xs text-zinc-500">Choose Solved or Needs work to save this attempt. Self-assessment is not automatic grading.</p>
          </details>
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3">
            <button
              type="button"
              onClick={() => onAsk(problem)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              <MessageSquare size={13} />
              Ask about this problem
            </button>
            <span className="ml-auto text-xs text-zinc-500">Self-assessment</span>
            <button
              type="button"
              onClick={() =>
                onAssess(problem.id, assessmentStatus === "solved" ? undefined : "solved", notes)
              }
              aria-pressed={assessmentStatus === "solved"}
              data-testid={`practice-assessment-solved-${problem.index}`}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
                assessmentStatus === "solved"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <CheckCircle2 size={13} />
              Solved
            </button>
            <button
              type="button"
              onClick={() =>
                onAssess(
                  problem.id,
                  assessmentStatus === "needs-work" ? undefined : "needs-work",
                  notes,
                )
              }
              aria-pressed={assessmentStatus === "needs-work"}
              data-testid={`practice-assessment-needs-work-${problem.index}`}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
                assessmentStatus === "needs-work"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <CircleHelp size={13} />
              Needs work
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
