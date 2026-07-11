"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { memo } from "react";

import type { AnswerFeedback, AnswerFeedbackIssue } from "@/types/learning";

type MessageFeedbackProps = {
  feedback?: AnswerFeedback;
  onChange: (feedback?: AnswerFeedback) => void;
};

const issueOptions: Array<{ id: AnswerFeedbackIssue; label: string }> = [
  { id: "unclear", label: "Not clear" },
  { id: "formula-error", label: "Formula issue" },
  { id: "citation-error", label: "Source issue" },
  { id: "other", label: "Other" },
];

export const MessageFeedback = memo(function MessageFeedback({
  feedback,
  onChange,
}: MessageFeedbackProps) {
  const isHelpful = feedback?.verdict === "helpful";
  const needsImprovement = feedback?.verdict === "needs-improvement";

  function setVerdict(verdict: AnswerFeedback["verdict"]) {
    if (feedback?.verdict === verdict) {
      onChange(undefined);
      return;
    }

    onChange({ verdict, updatedAt: Date.now() });
  }

  function setIssue(issue: AnswerFeedbackIssue) {
    onChange({
      verdict: "needs-improvement",
      issue: feedback?.issue === issue ? undefined : issue,
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-2.5" data-testid="answer-feedback">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span className="mr-1">Was this useful?</span>
        <button
          type="button"
          onClick={() => setVerdict("helpful")}
          aria-label="Mark answer as helpful"
          aria-pressed={isHelpful}
          data-testid="feedback-helpful"
          className={`flex size-7 items-center justify-center rounded-md border transition-colors ${
            isHelpful
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
          }`}
        >
          <ThumbsUp size={13} />
        </button>
        <button
          type="button"
          onClick={() => setVerdict("needs-improvement")}
          aria-label="Mark answer as needing improvement"
          aria-pressed={needsImprovement}
          data-testid="feedback-needs-improvement"
          className={`flex size-7 items-center justify-center rounded-md border transition-colors ${
            needsImprovement
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
          }`}
        >
          <ThumbsDown size={13} />
        </button>
        {isHelpful ? <span className="ml-1 text-zinc-600">Saved</span> : null}
      </div>

      {needsImprovement ? (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Feedback reason">
          {issueOptions.map((option) => {
            const selected = feedback?.issue === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setIssue(option.id)}
                aria-pressed={selected}
                className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                  selected
                    ? "border-zinc-700 bg-zinc-100 text-zinc-950"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
