"use client";

import { taskTypeOptions, type TaskTypeId } from "@/types/learning";

type TaskTypeSelectorProps = {
  value: TaskTypeId;
  onChange: (value: TaskTypeId) => void;
};

export function TaskTypeSelector({ value, onChange }: TaskTypeSelectorProps) {
  return (
    <label className="block space-y-2 text-sm font-medium text-zinc-800">
      <span>任务类型</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TaskTypeId)}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      >
        {taskTypeOptions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
