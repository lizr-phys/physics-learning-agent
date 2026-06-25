"use client";

import { Bookmark, CheckCircle2, HelpCircle, MoreHorizontal, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getStudyItems, upsertStudyItem } from "@/lib/study-items";
import type { StudyItemSource, StudyItemStatus, StudyItemType } from "@/types/study";

type StudyActionsProps = {
  title: string;
  content: string;
  source: StudyItemSource;
  type: StudyItemType;
  sessionId?: string;
  course?: string;
  knowledgeTitle?: string;
  compact?: boolean;
};

const actions: Array<{
  status: StudyItemStatus;
  label: string;
  icon: typeof Bookmark;
}> = [
  { status: "saved", label: "收藏", icon: Bookmark },
  { status: "unclear", label: "标记没懂", icon: HelpCircle },
  { status: "mastered", label: "标记已掌握", icon: CheckCircle2 },
  { status: "review", label: "加入复习", icon: RotateCcw },
];

export function StudyActions(props: StudyActionsProps) {
  const [open, setOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StudyItemStatus | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const existing = getStudyItems().find(
        (item) =>
          item.source === props.source &&
          item.type === props.type &&
          item.title === props.title &&
          item.sessionId === props.sessionId,
      );
      setCurrentStatus(existing?.status ?? null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [props.sessionId, props.source, props.title, props.type]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function save(status: StudyItemStatus) {
    upsertStudyItem({
      title: props.title,
      content: props.content,
      source: props.source,
      type: props.type,
      status,
      sessionId: props.sessionId,
      course: props.course,
      knowledgeTitle: props.knowledgeTitle,
    });
    setCurrentStatus(status);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
        aria-label="学习状态"
      >
        {currentStatus ? <Bookmark size={13} fill="currentColor" /> : <MoreHorizontal size={15} />}
        {!props.compact ? (currentStatus ? "已记录" : "更多") : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-50 w-36 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.status}
                type="button"
                onClick={() => save(action.status)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100"
              >
                <Icon size={14} />
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
