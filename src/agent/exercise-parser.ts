import { courseOptions } from "@/data/courses";
import { knowledgeItems } from "@/data/knowledge";
import type { CourseId, DifficultyId } from "@/types/learning";

const courseAliases: Record<Exclude<CourseId, "general">, string[]> = {
  "general-physics": ["普通物理", "大学物理", "中学物理", "物理教学", "基础物理"],
  "math-physics": ["数学物理方法", "数理方法", "数学物理"],
  "theoretical-mechanics": ["理论力学", "分析力学"],
  electrodynamics: ["电动力学"],
  "quantum-mechanics": ["量子力学", "量子"],
  "thermo-stat": ["热力学与统计物理", "热统", "统计物理"],
};

export type ParsedExerciseRequest = {
  detectedCourse?: Exclude<CourseId, "general">;
  detectedKnowledgeId?: string;
  count?: 3 | 5 | 10;
  difficulty?: DifficultyId;
  conflict?: {
    selectedCourse: Exclude<CourseId, "general">;
    detectedCourse: Exclude<CourseId, "general">;
  };
};

export function detectCourseFromText(text: string) {
  const normalized = text.toLowerCase();
  const direct = courseOptions.find((course) =>
    [course.label, course.shortLabel, ...courseAliases[course.id]].some((alias) =>
      normalized.includes(alias.toLowerCase()),
    ),
  );

  if (direct) {
    return direct.id;
  }

  return knowledgeItems.find(
    (item) =>
      normalized.includes(item.title.toLowerCase()) ||
      item.alias?.some((alias) => normalized.includes(alias.toLowerCase())),
  )?.course as Exclude<CourseId, "general"> | undefined;
}

export function detectKnowledgeFromText(text: string, course?: CourseId) {
  const normalized = text.toLowerCase();

  return knowledgeItems.find(
    (item) =>
      (!course || course === "general" || item.course === course) &&
      (normalized.includes(item.title.toLowerCase()) ||
        item.alias?.some((alias) => normalized.includes(alias.toLowerCase()))),
  )?.id;
}

function detectCount(text: string) {
  const match = text.match(/(?:生成|出|给我)?\s*(3|5|10)\s*道/);
  return match ? (Number(match[1]) as 3 | 5 | 10) : undefined;
}

function detectDifficulty(text: string): DifficultyId | undefined {
  if (/考研|竞赛/.test(text)) {
    return "exam";
  }

  if (/提高|综合|困难|难题/.test(text)) {
    return "advanced";
  }

  if (/基础|入门|简单/.test(text)) {
    return "basic";
  }

  if (/中等/.test(text)) {
    return "medium";
  }

  return undefined;
}

export function parseExerciseRequest(
  text: string,
  selectedCourse?: CourseId | "",
): ParsedExerciseRequest {
  const detectedCourse = detectCourseFromText(text);
  const selected =
    selectedCourse && selectedCourse !== "general"
      ? (selectedCourse as Exclude<CourseId, "general">)
      : undefined;

  return {
    detectedCourse,
    detectedKnowledgeId: detectKnowledgeFromText(text, detectedCourse ?? selected),
    count: detectCount(text),
    difficulty: detectDifficulty(text),
    conflict:
      selected && detectedCourse && selected !== detectedCourse
        ? { selectedCourse: selected, detectedCourse }
        : undefined,
  };
}
