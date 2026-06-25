"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import {
  deleteStudyItem,
  getStudyItems,
  updateStudyItemStatus,
} from "@/lib/study-items";
import type { StudyItem, StudyItemStatus } from "@/types/study";

const statusLabels: Record<StudyItemStatus, string> = {
  saved: "已收藏",
  unclear: "没弄懂",
  mastered: "已掌握",
  review: "待复习",
};

const sourceLabels: Record<StudyItem["source"], string> = {
  chat: "聊天",
  practice: "练习题",
  types: "题型梳理",
  review: "板块复习",
  map: "知识导览",
};

export function ReviewList() {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [filter, setFilter] = useState<StudyItemStatus | "all">("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(getStudyItems()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.status === filter)),
    [filter, items],
  );

  function changeStatus(itemId: string, status: StudyItemStatus) {
    setItems(updateStudyItemStatus(itemId, status));
  }

  function remove(itemId: string) {
    if (!window.confirm("确定删除这条本地学习记录吗？")) {
      return;
    }

    setItems(deleteStudyItem(itemId));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <div className="border-b border-zinc-200 pb-6">
        <h1 className="text-2xl font-semibold text-zinc-950">我的复习</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          收藏、没弄懂和加入复习的内容只保存在当前浏览器中。
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "review", "unclear", "saved", "mastered"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={
              filter === status
                ? "rounded-md bg-zinc-950 px-3 py-2 text-xs text-white"
                : "rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
            }
          >
            {status === "all" ? "全部" : statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <article key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-medium text-zinc-950">{item.title}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {sourceLabels[item.source]} · {statusLabels[item.status]} ·{" "}
                    {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950"
                  aria-label="删除学习记录"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <details className="mt-4 border-t border-zinc-200 pt-3">
                <summary className="cursor-pointer text-sm text-zinc-700">
                  查看保存内容
                </summary>
                <div className="mt-3">
                  <MarkdownRenderer content={item.content} />
                </div>
              </details>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  value={item.status}
                  onChange={(event) =>
                    changeStatus(item.id, event.target.value as StudyItemStatus)
                  }
                  className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {item.sessionId ? (
                  <Link
                    href={`/chat?sessionId=${encodeURIComponent(item.sessionId)}`}
                    className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    返回会话
                  </Link>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500">
            暂无符合条件的学习记录。
          </div>
        )}
      </div>
    </div>
  );
}
