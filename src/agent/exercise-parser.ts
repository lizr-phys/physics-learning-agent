import { courseOptions } from "@/data/courses";
import { knowledgeItems } from "@/data/knowledge";
import { detectLanguage } from "@/lib/language";
import type { CourseId, DetectedLanguage, DifficultyId, PracticeStyleId } from "@/types/learning";

const courseAliases: Record<Exclude<CourseId, "general">, string[]> = {
  "general-physics": [
    "普通物理",
    "大学物理",
    "基础物理",
    "basic physics",
    "introductory physics",
    "university physics",
  ],
  "math-physics": [
    "数学物理方法",
    "数理方法",
    "数学物理",
    "mathematical methods for physics",
    "mathematical methods",
    "math methods",
    "mathematical physics",
    "complex variables",
    "pde",
  ],
  "theoretical-mechanics": [
    "理论力学",
    "分析力学",
    "classical mechanics",
    "classical mechanics",
    "analytical mechanics",
    "lagrangian mechanics",
    "hamiltonian mechanics",
    "central-force motion",
  ],
  electrodynamics: [
    "电动力学",
    "electrodynamics",
    "electricity and magnetism",
    "e&m",
    "electromagnetism",
    "electrostatic",
    "magnetostatic",
  ],
  "quantum-mechanics": [
    "量子力学",
    "量子",
    "quantum mechanics",
    "quantum physics",
    "harmonic oscillator",
    "stationary state",
    "one-dimensional stationary",
  ],
  "thermo-stat": [
    "热力学与统计物理",
    "热统",
    "统计物理",
    "thermal physics",
    "statistical mechanics",
    "statistical physics",
    "thermodynamics",
    "canonical ensemble",
    "partition function",
  ],
};

export type ParsedExerciseRequest = {
  detectedCourse?: Exclude<CourseId, "general">;
  detectedKnowledgeId?: string;
  count?: 3 | 5 | 10;
  difficulty?: DifficultyId;
  language?: DetectedLanguage;
  practiceStyle?: PracticeStyleId;
  conflict?: {
    selectedCourse: Exclude<CourseId, "general">;
    detectedCourse: Exclude<CourseId, "general">;
  };
};

function normalizeSearchText(text: string) {
  return text
    .toLowerCase()
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function allCourseAliases() {
  return courseOptions
    .flatMap((course) =>
      [course.label, course.shortLabel, ...courseAliases[course.id]].map((alias) => ({
        course: course.id,
        alias: normalizeSearchText(alias),
      })),
    )
    .filter((item) => item.alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length);
}

export function detectCourseFromText(text: string) {
  const normalized = normalizeSearchText(text);
  const direct = allCourseAliases().find((item) => normalized.includes(item.alias));

  if (direct) {
    return direct.course;
  }

  return knowledgeItems.find(
    (item) =>
      normalized.includes(item.title.toLowerCase()) ||
      item.alias?.some((alias) => normalized.includes(normalizeSearchText(alias))),
  )?.course as Exclude<CourseId, "general"> | undefined;
}

export function detectKnowledgeFromText(text: string, course?: CourseId) {
  const normalized = normalizeSearchText(text);

  return knowledgeItems.find(
    (item) =>
      (!course || course === "general" || item.course === course) &&
      (normalized.includes(normalizeSearchText(item.title)) ||
        item.alias?.some((alias) => normalized.includes(normalizeSearchText(alias)))),
  )?.id;
}

function detectCount(text: string) {
  const match =
    text.match(/(?:生成|出|给我)?\s*(3|5|10)\s*道/) ??
    text.match(/\b(3|5|10)\s+(?:practice\s+)?(?:problem|problems|exercises)\b/i) ??
    text.match(/\b(3|5|10)\b(?=.{0,100}\b(?:problem|problems|exercises)\b)/i);

  return match ? (Number(match[1]) as 3 | 5 | 10) : undefined;
}

function detectDifficulty(text: string): DifficultyId | undefined {
  if (/考研|竞赛|postgraduate|entrance exam|qualifying|competition/i.test(text)) {
    return "exam";
  }

  if (/提高|综合|困难|难题|harder|advanced|challenging|difficult/i.test(text)) {
    return "advanced";
  }

  if (/基础|入门|简单|basic|introductory|easy/i.test(text)) {
    return "basic";
  }

  if (/中等|intermediate|medium/i.test(text)) {
    return "medium";
  }

  return undefined;
}

export function detectPracticeStyleFromText(text: string): PracticeStyleId | undefined {
  if (/考研|postgraduate entrance exam/i.test(text)) {
    return "chinese-postgraduate-exam";
  }

  if (/期末|final exam/i.test(text)) {
    return "chinese-final-exam";
  }

  if (/mit|ocw|open[-\s]?course|problem[-\s]?set|assignment/i.test(text)) {
    return "open-course";
  }

  if (/english textbook|griffiths|sakurai|shankar|goldstein|jackson|schroeder/i.test(text)) {
    return "english-textbook";
  }

  if (/中文教材|课后题|教材课后|chinese textbook/i.test(text)) {
    return "chinese-textbook";
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
    language: detectLanguage(text),
    practiceStyle: detectPracticeStyleFromText(text),
    conflict:
      selected && detectedCourse && selected !== detectedCourse
        ? { selectedCourse: selected, detectedCourse }
        : undefined,
  };
}
