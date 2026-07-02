"use client";

import { courseOptions } from "@/data/courses";
import type { CourseId } from "@/types/learning";

type CourseSelectorProps = {
  value: CourseId | "";
  onChange: (value: CourseId | "") => void;
  label?: string;
  placeholder?: string;
};

export function CourseSelector({
  value,
  onChange,
  label = "Course",
  placeholder,
}: CourseSelectorProps) {
  return (
    <label className="block space-y-2 text-sm font-medium text-zinc-800">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as CourseId | "")}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
        data-testid="course-selector"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {courseOptions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
