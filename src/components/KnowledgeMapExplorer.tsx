"use client";

import Link from "next/link";
import { Bot, PenLine } from "lucide-react";
import { useMemo, useState } from "react";

import { courseOptions } from "@/data/courses";
import { getKnowledgeByCourse, getKnowledgeItem } from "@/data/knowledge";
import { buildChatHref } from "@/lib/routes";
import { ensureBlockMath } from "@/lib/markdown-math";
import { MarkdownRenderer } from "@/components/common/LazyMarkdownRenderer";
import { WorkspaceHeading } from "@/components/layout/WorkspaceHeading";
import type { CourseId } from "@/types/learning";

const hanTextPattern = /[\u3400-\u9fff]/u;

function getVisibleEnglishItems(items: string[] = []) {
  return items.filter((item) => !hanTextPattern.test(item));
}

function listText(items: string[]) {
  const visibleItems = getVisibleEnglishItems(items);

  return visibleItems.length ? visibleItems.join(" / ") : "None";
}

export function KnowledgeMapExplorer() {
  const [course, setCourse] = useState<CourseId>("math-physics");
  const courseItems = useMemo(() => getKnowledgeByCourse(course), [course]);
  const [selectedId, setSelectedId] = useState(courseItems[0]?.id ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  const [pitfallsOpen, setPitfallsOpen] = useState(false);
  const selectedItem = getKnowledgeItem(selectedId) ?? courseItems[0];
  const visibleAliases = getVisibleEnglishItems(selectedItem?.alias);
  const visibleTypicalProblems = getVisibleEnglishItems(selectedItem?.typicalProblems);
  const visibleMisunderstandings = getVisibleEnglishItems(selectedItem?.commonMisunderstandings);
  const visibleTags = getVisibleEnglishItems(selectedItem?.tags);

  function selectCourse(nextCourse: CourseId) {
    const nextItems = getKnowledgeByCourse(nextCourse);
    setCourse(nextCourse);
    setSelectedId(nextItems[0]?.id ?? "");
  }

  if (!selectedItem) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 md:px-8">
      <WorkspaceHeading title="Knowledge Map" description="Explore concepts, formulas and their connections." />

      <div className="grid gap-3 sm:grid-cols-2">
      <label className="block min-w-0 space-y-2 text-sm text-zinc-700">
        <span>Course</span>
        <select aria-label="Course" value={course} onChange={event => selectCourse(event.target.value as CourseId)} className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3">
          {courseOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="block min-w-0 space-y-2 text-sm text-zinc-700">
        <span>Topic</span>
        <select aria-label="Topic" value={selectedItem.id} onChange={event => setSelectedId(event.target.value)} className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950">
          {courseItems.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      </div>
        <section className="min-w-0 border-t border-zinc-200 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
                {selectedItem.title}
              </h2>
            </div>
            <span className="rounded-md bg-study-50 px-2 py-1 text-xs font-medium text-study-800">
              {selectedItem.difficulty === "basic"
                ? "Basic"
                : selectedItem.difficulty === "intermediate"
                  ? "Intermediate"
                  : "Advanced"}
            </span>
          </div>

          <div className="mt-5 grid gap-5">
            <section>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={selectedItem.description} />
              </div>
            </section>

            <details onToggle={event => setNotesOpen(event.currentTarget.open)} className="text-sm text-zinc-700">
            <summary className="cursor-pointer py-2">Notes, prerequisites and typical problems</summary>
            {notesOpen ? <div className="mt-4 space-y-4">
            {visibleAliases.length ? <p className="text-xs text-zinc-500">Aliases: {visibleAliases.join(" / ")}</p> : null}
            <section>
              <h3 className="text-sm font-semibold text-zinc-950">Textbook-Style Note</h3>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={selectedItem.textbookStyleSummary} />
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold text-zinc-950">Prerequisites</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {listText(selectedItem.prerequisites)}
                </p>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-zinc-950">Related Topics</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {listText(selectedItem.related)}
                </p>
              </section>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-zinc-950">Typical Problems</h3>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={visibleTypicalProblems.map((problem) => `- ${problem}`).join("\n")} />
              </div>
            </section>
            </div> : null}
            </details>

            {selectedItem.keyFormulas?.length ? (
              <section>
                <h3 className="text-sm font-semibold text-zinc-950">Key Formulas</h3>
                <div className="mt-2 rounded-xl bg-zinc-50 p-4">
                  <MarkdownRenderer
                    content={selectedItem.keyFormulas.map((formula) => ensureBlockMath(formula)).join("\n\n")}
                  />
                </div>
              </section>
            ) : null}

            {visibleMisunderstandings.length ? (
              <details onToggle={event => setPitfallsOpen(event.currentTarget.open)}>
                <summary className="cursor-pointer py-2 text-sm font-medium text-zinc-800">Common Pitfalls</summary>
                {pitfallsOpen ? <div className="mt-2 text-sm leading-6 text-zinc-600">
                  <MarkdownRenderer
                    content={visibleMisunderstandings.map((item) => `- ${item}`).join("\n")}
                  />
                </div> : null}
              </details>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <span key={tag} className="text-xs text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>

            <div className="grid gap-2 border-t border-zinc-200 pt-5 sm:grid-cols-2">
              <Link
                href={buildChatHref({
                  course: selectedItem.course,
                  taskType: "explain",
                  knowledgePoint: selectedItem.id,
                  prompt: `Explain the definition, intuition, mathematical expression, typical uses, and common pitfalls of ${selectedItem.title}.`,
                })}
                className="study-primary"
              >
                <Bot size={15} />
                Ask in Chat
              </Link>
              <Link
                href={buildChatHref({
                  course: selectedItem.course,
                  taskType: "practice",
                  knowledgePoint: selectedItem.id,
                  prompt: `Generate 5 original practice problems on ${selectedItem.title}. Include hints, detailed solutions, and final answers.`,
                })}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-study-50"
              >
                <PenLine size={15} />
                Generate Practice
              </Link>
            </div>
          </div>
        </section>
    </div>
  );
}
