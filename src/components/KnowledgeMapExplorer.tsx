"use client";

import Link from "next/link";
import { Bot, PenLine } from "lucide-react";
import { useMemo, useState } from "react";

import { courseOptions } from "@/data/courses";
import { getKnowledgeByCourse, getKnowledgeItem } from "@/data/knowledge";
import { buildChatHref } from "@/lib/routes";
import { ensureBlockMath } from "@/lib/markdown-math";
import { MarkdownRenderer } from "@/components/common/LazyMarkdownRenderer";
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
  const selectedItem = getKnowledgeItem(selectedId) ?? courseItems[0];
  const selectedCourse = courseOptions.find((item) => item.id === course);
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
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Knowledge Map</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Explore concepts, formulas and their connections.
        </p>
      </section>

      <label className="block max-w-md text-sm text-zinc-700">
        <span className="sr-only">Course</span>
        <select aria-label="Course" value={course} onChange={event => selectCourse(event.target.value as CourseId)} className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3">
          {courseOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <section className="min-w-0">
          <h2 className="px-2 text-xs font-medium text-zinc-500">{courseItems.length} topics</h2>
          <div className="mt-3 max-h-60 space-y-1 overflow-y-auto pr-1 lg:max-h-[680px]">
            {courseItems.map((item) => {
              const active = item.id === selectedItem.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={
                    active
                      ? "w-full rounded-md border border-zinc-950 bg-zinc-50 px-3 py-2 text-left"
                      : "w-full rounded-md border border-transparent px-3 py-2 text-left hover:border-zinc-200 hover:bg-zinc-50"
                  }
                >
                  <span className="text-xs text-zinc-500">#{item.studyOrder}</span>
                  <span className="ml-2 text-sm font-medium text-zinc-950">{item.title}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 border-t border-zinc-200 pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500">{selectedCourse?.label}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                {selectedItem.title}
              </h2>
              {visibleAliases.length ? (
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Aliases: {visibleAliases.join(" / ")}
                </p>
              ) : null}
            </div>
            <span className="w-fit rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
              {selectedItem.difficulty === "basic"
                ? "Basic"
                : selectedItem.difficulty === "intermediate"
                  ? "Intermediate"
                  : "Advanced"}
            </span>
          </div>

          <div className="mt-5 grid gap-5">
            <section>
              <h3 className="text-sm font-semibold text-zinc-950">Brief Definition</h3>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={selectedItem.description} />
              </div>
            </section>

            <details className="text-sm text-zinc-600">
            <summary className="cursor-pointer py-1">Notes, prerequisites and typical problems</summary>
            <div className="mt-4 space-y-4">
            <section>
              <h3 className="text-sm font-semibold text-zinc-950">Textbook-Style Note</h3>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={selectedItem.textbookStyleSummary} />
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-md border border-zinc-200 p-4">
                <h3 className="text-sm font-semibold text-zinc-950">Prerequisites</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {listText(selectedItem.prerequisites)}
                </p>
              </section>
              <section className="rounded-md border border-zinc-200 p-4">
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
            </div>
            </details>

            {selectedItem.keyFormulas?.length ? (
              <section>
                <h3 className="text-sm font-semibold text-zinc-950">Key Formulas</h3>
                <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <MarkdownRenderer
                    content={selectedItem.keyFormulas.map((formula) => ensureBlockMath(formula)).join("\n\n")}
                  />
                </div>
              </section>
            ) : null}

            {visibleMisunderstandings.length ? (
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-zinc-950">Common Pitfalls</summary>
                <div className="mt-2 text-sm leading-6 text-zinc-600">
                  <MarkdownRenderer
                    content={visibleMisunderstandings.map((item) => `- ${item}`).join("\n")}
                  />
                </div>
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
                className="flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
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
                className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:border-zinc-950"
              >
                <PenLine size={15} />
                Generate Practice
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
