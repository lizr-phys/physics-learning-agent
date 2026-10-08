"use client";

import { useMemo } from "react";

import { ContentOutline } from "@/components/common/ContentOutline";
import { MarkdownRenderer } from "@/components/common/LazyMarkdownRenderer";
import { PracticeProblemCard } from "@/components/practice/PracticeProblemCard";
import { createContentScope, createHeadingId } from "@/lib/content-outline";
import { parsePracticeProblems, type ParsedPracticeProblem } from "@/lib/practice-parser";
import type {
  PracticeAssessment,
  PracticeAssessmentStatus,
  PracticeOutputMode,
} from "@/types/learning";

type PracticeResultListProps = {
  content: string;
  onAsk: (problem: ParsedPracticeProblem) => void;
  assessments: Record<string, PracticeAssessment>;
  onAssess: (problemId: number | string, status?: PracticeAssessmentStatus, notes?: { attemptDraft?: string; stuckNote?: string }) => void;
  outputMode?: PracticeOutputMode;
  streaming?: boolean;
};

export function PracticeResultList({
  content,
  onAsk,
  assessments,
  onAssess,
  outputMode,
  streaming,
}: PracticeResultListProps) {
  const problems = useMemo(() => parsePracticeProblems(content), [content]);
  const headingScope = useMemo(() => createContentScope(content), [content]);

  if (!problems.length) {
    return (
      <div className="space-y-4">
        <ContentOutline content={content} />
        <MarkdownRenderer content={content} streaming={streaming} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="practice-result-list">
      <ContentOutline content={content} />
      {problems.map((problem) => (
        <PracticeProblemCard
          key={problem.id}
          problem={problem}
          onAsk={onAsk}
          assessment={assessments[problem.id] ?? assessments[String(problem.index)]}
          outputMode={outputMode}
          onAssess={onAssess}
          headingId={createHeadingId(problem.title, problem.index - 1, headingScope)}
        />
      ))}
    </div>
  );
}
