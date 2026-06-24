"use client";

import { memo } from "react";

import { courseOptions } from "@/data/courses";
import { getKnowledgeTitle } from "@/data/knowledge";
import { taskTypeOptions, type CourseId, type TaskTypeId } from "@/types/learning";
import { KnowledgeSelector } from "@/components/selectors/KnowledgeSelector";

type TopContextBarProps = {
  course: CourseId;
  taskType: TaskTypeId;
  knowledgePoint: string;
  useRag: boolean;
  onCourseChange: (course: CourseId) => void;
  onTaskTypeChange: (taskType: TaskTypeId) => void;
  onKnowledgePointChange: (knowledgePoint: string) => void;
  onUseRagChange: (value: boolean) => void;
};

export const TopContextBar = memo(function TopContextBar({
  course,
  taskType,
  knowledgePoint,
  useRag,
  onCourseChange,
  onTaskTypeChange,
  onKnowledgePointChange,
  onUseRagChange,
}: TopContextBarProps) {
  const courseLabel = courseOptions.find((item) => item.id === course)?.label ?? "未指定课程";
  const taskLabel = taskTypeOptions.find((item) => item.id === taskType)?.label ?? "普通问答";
  const knowledgeTitle = getKnowledgeTitle(knowledgePoint) || "未指定知识点";

  return (
    <div className="bg-white px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="truncate text-sm text-zinc-500">
          <span className="font-medium text-zinc-950">{courseLabel}</span>
          <span> · {taskLabel} · {knowledgeTitle}</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <select
            value={course}
            onChange={(event) => onCourseChange(event.target.value as CourseId)}
            className="h-9 shrink-0 rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none hover:border-zinc-400 focus:border-zinc-500"
          >
            {courseOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={taskType}
            onChange={(event) => onTaskTypeChange(event.target.value as TaskTypeId)}
            className="h-9 shrink-0 rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none hover:border-zinc-400 focus:border-zinc-500"
          >
            {taskTypeOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <KnowledgeSelector
            compact
            course={course}
            value={knowledgePoint}
            onChange={onKnowledgePointChange}
          />

          <label className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={useRag}
              onChange={(event) => onUseRagChange(event.target.checked)}
              className="size-4 accent-zinc-950"
            />
            使用本地知识库
          </label>
        </div>
      </div>
    </div>
  );
});
