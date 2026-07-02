"use client";

import Link from "next/link";
import { Bot, PenLine, Route } from "lucide-react";
import { useMemo, useState } from "react";

import { courseOptions } from "@/data/courses";
import { getKnowledgeByCourse, getKnowledgeItem } from "@/data/knowledge";
import { buildChatHref } from "@/lib/routes";
import {
  ensureBlockMath,
  MarkdownRenderer,
} from "@/components/common/MarkdownRenderer";
import type { CourseId } from "@/types/learning";

function listText(items: string[]) {
  return items.length ? items.join(" / ") : "None";
}

export function KnowledgeMapExplorer() {
  const [course, setCourse] = useState<CourseId>("math-physics");
  const courseItems = useMemo(() => getKnowledgeByCourse(course), [course]);
  const [selectedId, setSelectedId] = useState(courseItems[0]?.id ?? "");
  const selectedItem = getKnowledgeItem(selectedId) ?? courseItems[0];
  const selectedCourse = courseOptions.find((item) => item.id === course);

  function selectCourse(nextCourse: CourseId) {
    const nextItems = getKnowledgeByCourse(nextCourse);
    setCourse(nextCourse);
    setSelectedId(nextItems[0]?.id ?? "");
  }

  if (!selectedItem) {
    return null;
  }

  return (
    <div className="space-y-6 px-4 py-8 md:px-6">
      <section className="border-b border-zinc-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Knowledge Map</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Browse the undergraduate physics knowledge structure. Select a course, inspect the topic sequence, and use the details panel for definitions, prerequisites, formulas, typical problems, and pitfalls.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_320px_1fr]">
        <aside className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-zinc-950">
            <Route size={15} />
            Course
          </div>
          <div className="space-y-1">
            {courseOptions.map((item) => {
              const active = item.id === course;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectCourse(item.id)}
                  className={
                    active
                      ? "w-full rounded-md bg-zinc-950 px-3 py-2 text-left text-sm text-white"
                      : "w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                  }
                >
                  <span className="block font-medium">{item.label}</span>
                  <span className={active ? "text-xs text-zinc-300" : "text-xs text-zinc-500"}>
                    {getKnowledgeByCourse(item.id).length} topics
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="border-b border-zinc-200 px-2 pb-3">
            <h2 className="text-sm font-semibold text-zinc-950">{selectedCourse?.label}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{selectedCourse?.contextSummary}</p>
          </div>
          <div className="mt-3 max-h-[680px] space-y-1 overflow-y-auto pr-1">
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
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-zinc-500">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500">{selectedCourse?.label}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                {selectedItem.title}
              </h2>
              {selectedItem.alias?.length ? (
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Aliases: {selectedItem.alias.join(" / ")}
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
                <MarkdownRenderer content={selectedItem.typicalProblems.map((problem) => `- ${problem}`).join("\n")} />
              </div>
            </section>

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

            {selectedItem.commonMisunderstandings?.length ? (
              <section>
                <h3 className="text-sm font-semibold text-zinc-950">Common Pitfalls</h3>
                <div className="mt-2 text-sm leading-6 text-zinc-600">
                  <MarkdownRenderer
                    content={selectedItem.commonMisunderstandings.map((item) => `- ${item}`).join("\n")}
                  />
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selectedItem.tags.map((tag) => (
                <span key={tag} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
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
