"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Bot, ListChecks, PenLine, Route } from "lucide-react";
import { useMemo, useState } from "react";

import { courseOptions } from "@/data/courses";
import { getKnowledgeByCourse, getKnowledgeItem } from "@/data/knowledge";
import { buildChatHref } from "@/lib/routes";
import { ensureBlockMath } from "@/components/common/MarkdownRenderer";
import { StudyActions } from "@/components/common/StudyActions";
import type { CourseId } from "@/types/learning";

const MarkdownRenderer = dynamic(
  () => import("@/components/common/MarkdownRenderer").then((module) => module.MarkdownRenderer),
  {
    ssr: false,
    loading: () => <div className="text-sm text-zinc-500">正在排版公式...</div>,
  },
);

function listText(items: string[]) {
  return items.length ? items.join(" / ") : "无";
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
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">课程知识目录</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          知识库按国内大学物理专业本科课程组织。左侧选择课程，中间查看学习顺序，右侧展示定义、前置关系、题型、公式和易错点。
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_320px_1fr]">
        <aside className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-zinc-950">
            <Route size={15} />
            课程
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
                    {getKnowledgeByCourse(item.id).length} 个条目
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
                  别名：{selectedItem.alias.join(" / ")}
                </p>
              ) : null}
            </div>
            <span className="w-fit rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
              {selectedItem.difficulty === "basic"
                ? "基础"
                : selectedItem.difficulty === "intermediate"
                  ? "中等"
                  : "提高"}
            </span>
          </div>

          <div className="mt-5 grid gap-5">
            <section>
              <h3 className="text-sm font-semibold text-zinc-950">简要定义</h3>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={selectedItem.description} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-zinc-950">教材式说明</h3>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={selectedItem.textbookStyleSummary} />
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-md border border-zinc-200 p-4">
                <h3 className="text-sm font-semibold text-zinc-950">前置知识</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {listText(selectedItem.prerequisites)}
                </p>
              </section>
              <section className="rounded-md border border-zinc-200 p-4">
                <h3 className="text-sm font-semibold text-zinc-950">后续关联</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {listText(selectedItem.related)}
                </p>
              </section>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-zinc-950">常见题型</h3>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                <MarkdownRenderer content={selectedItem.typicalProblems.map((problem) => `- ${problem}`).join("\n")} />
              </div>
            </section>

            {selectedItem.keyFormulas?.length ? (
              <section>
                <h3 className="text-sm font-semibold text-zinc-950">常用公式</h3>
                <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <MarkdownRenderer
                    content={selectedItem.keyFormulas.map((formula) => ensureBlockMath(formula)).join("\n\n")}
                  />
                </div>
              </section>
            ) : null}

            {selectedItem.commonMisunderstandings?.length ? (
              <section>
                <h3 className="text-sm font-semibold text-zinc-950">易错点</h3>
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

            <div className="grid gap-2 border-t border-zinc-200 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                href={buildChatHref({
                  course: selectedItem.course,
                  taskType: "explain",
                  knowledgePoint: selectedItem.id,
                  prompt: `请解释「${selectedItem.title}」的定义、直观理解、数学表达、典型用途和易错点。`,
                })}
                className="flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                <Bot size={15} />
                向 Agent 提问
              </Link>
              <Link
                href={buildChatHref({
                  course: selectedItem.course,
                  taskType: "practice",
                  knowledgePoint: selectedItem.id,
                  prompt: `请生成 5 道关于「${selectedItem.title}」的练习题，需要提示、详细解析和最终答案。`,
                })}
                className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:border-zinc-950"
              >
                <PenLine size={15} />
                生成练习题
              </Link>
              <Link
                href={buildChatHref({
                  course: selectedItem.course,
                  taskType: "problem-types",
                  knowledgePoint: selectedItem.id,
                  prompt: `请梳理「${selectedItem.title}」的题型特征、建模步骤、方程建立、求解流程、检验方法和变式训练。`,
                })}
                className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:border-zinc-950"
              >
                <ListChecks size={15} />
                梳理题型
              </Link>
              <div className="flex items-center justify-center rounded-md border border-zinc-300 px-3 py-2">
                <StudyActions
                  title={selectedItem.title}
                  content={[
                    selectedItem.description,
                    selectedItem.textbookStyleSummary,
                    ...selectedItem.typicalProblems.map((problem) => `- ${problem}`),
                  ].join("\n\n")}
                  source="map"
                  type="knowledge"
                  course={selectedCourse?.label}
                  knowledgeTitle={selectedItem.title}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
