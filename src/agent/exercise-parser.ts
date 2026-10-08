import { courseOptions } from "@/data/courses";
import { knowledgeItems } from "@/data/knowledge";
import { detectLanguage } from "@/lib/language";
import type { CourseId, DetectedLanguage, DifficultyId, PracticeStyleId } from "@/types/learning";

const courseAliases: Record<Exclude<CourseId, "general">, string[]> = {
  "general-physics": [
    "普通物理",
    "大学物理",
    "general physics",
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
    "哈密顿力学",
    "哈密顿方程",
    "哈密顿正则方程",
    "正则方程",
    "正则变量",
    "正则变换",
    "泊松括号",
    "拉格朗日力学",
    "拉格朗日方程",
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
  count?: number;
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

function withoutNegatedClauses(text: string) {
  return text
    .replace(/(?:不要|不用|别用|不采用|不需要|不要用)[^，,。;；\n]*(?=[，,。;；\n]|$)/g, " ")
    .replace(/\b(?:not|don't|do not|without)\s+[^,;.\n]*?(?=\b(?:but|instead)\b|[,;.\n]|$)/gi, " ");
}

function hasAlias(text: string, alias: string) {
  if (/^[\x00-\x7f]+$/.test(alias)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(text);
  }
  return text.includes(alias);
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
  const normalized = normalizeSearchText(withoutNegatedClauses(text));
  const switchText = normalized.match(/(?:switch(?:\s+\w+){0,3}\s+to|change(?:\s+\w+){0,3}\s+to|切换到|换成|改学|改成)\s*(.+)$/i)?.[1];
  const direct = allCourseAliases().find((item) => hasAlias(switchText ?? normalized, item.alias));

  if (direct) {
    return direct.course;
  }

  return knowledgeItems.find(
    (item) =>
      normalized.includes(item.title.toLowerCase()) ||
      item.alias?.some((alias) => normalized.includes(normalizeSearchText(alias))),
  )?.course as Exclude<CourseId, "general"> | undefined;
}

export function detectNamedCourseFromText(text: string) {
  const normalized = normalizeSearchText(withoutNegatedClauses(text));
  const topicOnlyAliases = new Set([
    "complex variables", "pde", "harmonic oscillator", "stationary state",
    "one dimensional stationary", "canonical ensemble", "partition function",
    "central force motion", "electrostatic", "magnetostatic",
  ]);
  return allCourseAliases().find((item) => !topicOnlyAliases.has(item.alias) && hasAlias(normalized, item.alias))?.course;
}

export function detectKnowledgeFromText(text: string, course?: CourseId) {
  const normalized = normalizeSearchText(withoutNegatedClauses(text));

  return knowledgeItems.find(
    (item) =>
      (!course || course === "general" || item.course === course) &&
      (normalized.includes(normalizeSearchText(item.title)) ||
        item.alias?.some((alias) => normalized.includes(normalizeSearchText(alias)))),
  )?.id;
}

export function detectExerciseCount(text: string) {
  const normalized = withoutNegatedClauses(text);
  const englishNumbers: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  };
  const match =
    normalized.match(/(\d+|[一二两三四五六七八九十]+)\s*(?:道|题)/) ??
    normalized.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:(?:more|new|additional|practice|original)\s+)*(?:problems?|exercises?)\b/i) ??
    normalized.match(/\b(?:generate|create|give me|make)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b(?=.{0,140}\b(?:problems?|exercises?)\b)/i);

  if (!match) return undefined;
  const raw = match[1].toLowerCase();
  const chineseDigits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const chinese = raw.includes("十")
    ? (chineseDigits[raw.split("十")[0]] ?? 1) * 10 + (chineseDigits[raw.split("十")[1]] ?? 0)
    : chineseDigits[raw];
  const count = englishNumbers[raw] ?? chinese ?? Number(raw);

  return Number.isInteger(count) && count >= 1 && count <= 20 ? count : undefined;
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
  const positiveText = withoutNegatedClauses(text);
  if (/考研|postgraduate entrance exam/i.test(positiveText)) {
    return "chinese-postgraduate-exam";
  }

  if (/期末|chinese\s+(?:university\s+)?final exam/i.test(positiveText)) {
    return "chinese-final-exam";
  }

  if (/\b(?:mit|ocw|open[-\s]?course|problem[-\s]?set|assignment)\b/i.test(positiveText)) {
    return "open-course";
  }

  if (/英文教材|英语教材|\b(?:english textbook|griffiths|sakurai|shankar|goldstein|jackson|schroeder|final exam)\b/i.test(positiveText)) {
    return "english-textbook";
  }

  if (/中文教材|课后题|教材课后|chinese textbook/i.test(positiveText)) {
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
    count: detectExerciseCount(text),
    difficulty: detectDifficulty(text),
    language: detectLanguage(text),
    practiceStyle: detectPracticeStyleFromText(text),
    conflict:
      selected && detectedCourse && selected !== detectedCourse
        ? { selectedCourse: selected, detectedCourse }
        : undefined,
  };
}
