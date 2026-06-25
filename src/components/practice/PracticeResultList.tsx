"use client";

import { useMemo } from "react";

import { ContentOutline } from "@/components/common/ContentOutline";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import { PracticeProblemCard } from "@/components/practice/PracticeProblemCard";
import { createContentScope, createHeadingId } from "@/lib/content-outline";
import { parsePracticeProblems, type ParsedPracticeProblem } from "@/lib/practice-parser";

type PracticeResultListProps = {
  content: string;
  onAsk: (problem: ParsedPracticeProblem) => void;
};

export function PracticeResultList({
  content,
  onAsk,
}: PracticeResultListProps) {
  const problems = useMemo(() => parsePracticeProblems(content), [content]);
  const headingScope = useMemo(() => createContentScope(content), [content]);

  if (!problems.length) {
    return (
      <div className="space-y-4">
        <ContentOutline content={content} />
        <MarkdownRenderer content={content} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="practice-result-list">
      <ContentOutline content={content} />
      {problems.map((problem) => (
        <PracticeProblemCard
          key={`${problem.index}-${problem.title}`}
          problem={problem}
          onAsk={onAsk}
          headingId={createHeadingId(problem.title, problem.index - 1, headingScope)}
        />
      ))}
    </div>
  );
}
