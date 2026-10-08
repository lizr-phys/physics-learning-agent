export type ParsedPracticeProblem = {
  id: string;
  schemaVersion: 2;
  index: number;
  title: string;
  sourceStyle?: string;
  trainingGoal?: string;
  knowledge?: string;
  difficulty?: string;
  conditions?: string;
  problem: string;
  hint?: string;
  solution?: string;
  answer?: string;
  pitfalls?: string;
  rawContent: string;
  presentFields: string[];
};

type PracticeField = "sourceStyle" | "trainingGoal" | "knowledge" | "difficulty" | "conditions" | "problem" | "hint" | "solution" | "answer" | "pitfalls";
const labelMap: Record<string, PracticeField> = {
  "source style": "sourceStyle",
  "题型风格": "sourceStyle",
  "题型来源风格": "sourceStyle",
  "training goal": "trainingGoal",
  "训练目标": "trainingGoal",
  problem: "problem",
  "题目": "problem",
  topics: "knowledge",
  "topic": "knowledge",
  "involved topics": "knowledge",
  "涉及知识点": "knowledge",
  difficulty: "difficulty",
  "难度": "difficulty",
  conditions: "conditions",
  assumptions: "conditions",
  "条件": "conditions",
  "已知条件": "conditions",
  "适用条件": "conditions",
  hint: "hint",
  "提示": "hint",
  solution: "solution",
  "detailed solution": "solution",
  "解析": "solution",
  "详细解析": "solution",
  answer: "answer",
  "final answer": "answer",
  "答案": "answer",
  "最终答案": "answer",
  "common mistakes": "pitfalls",
  pitfalls: "pitfalls",
  "易错点": "pitfalls",
};

const fieldPattern =
  /^\*\*([^*]+?)\s*[:：]?\*\*\s*[:：]?\s*(.*)$/;

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

function problemNumber(title: string, fallback: number) {
  const value = title.match(/^(?:Problem|题目)\s*([0-9一二三四五六七八九十]+)/i)?.[1] ?? "";
  if (/^\d+$/.test(value)) return Number(value);
  const digits = "一二三四五六七八九";
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (tens ? digits.indexOf(tens) + 1 : 1) * 10 + (ones ? digits.indexOf(ones) + 1 : 0);
  }
  return digits.indexOf(value) >= 0 ? digits.indexOf(value) + 1 : fallback;
}

function parseProblemBlock(title: string, content: string, index: number, setId?: string): ParsedPracticeProblem {
  const fields: Partial<Record<PracticeField, string>> = {};
  let activeField: PracticeField | null = null;
  const explicitId = content.match(/<!--\s*pla:problem-id\s+([A-Za-z0-9:._-]{1,180})\s*-->/)?.[1];
  content = content.replace(/<!--\s*pla:problem-id\s+[A-Za-z0-9:._-]+\s*-->/g, "").trim();

  for (const line of content.split(/\r?\n/)) {
    const label = line.match(fieldPattern);

    if (label && labelMap[normalizeLabel(label[1])]) {
      activeField = labelMap[normalizeLabel(label[1])];

      if (activeField) {
        fields[activeField] = label[2].trim();
      }
      continue;
    }

    if (activeField && line.trim()) {
      fields[activeField] = `${String(fields[activeField] ?? "")}\n${line}`.trim();
    }
  }

  return {
    id: explicitId ?? (setId ? `${setId}:problem:${index}` : `legacy-${stableHash(`${title.replace(/^(?:Problem|题目)\s*[0-9一二三四五六七八九十]+/i, "")}\n${fields.problem || content}`)}`),
    schemaVersion: 2,
    index,
    title,
    sourceStyle: fields.sourceStyle,
    trainingGoal: fields.trainingGoal,
    knowledge: fields.knowledge,
    difficulty: fields.difficulty,
    conditions: fields.conditions,
    problem: fields.problem || content,
    hint: fields.hint,
    solution: fields.solution,
    answer: fields.answer,
    pitfalls: fields.pitfalls,
    rawContent: `### ${title}\n${content}`.trim(),
    presentFields: Object.keys(fields),
  };
}

export function parsePracticeProblems(content: string, options: { setId?: string } = {}): ParsedPracticeProblem[] {
  const headings = content.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, code => code.replace(/[^\n]/g, " "));
  const matches = Array.from(
    headings.matchAll(/^###\s*((?:Problem|题目)\s*[0-9一二三四五六七八九十]+[^\n]*)$/gim),
  );

  if (!matches.length) {
    return [];
  }

  return matches.map((match, arrayIndex) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[arrayIndex + 1]?.index ?? content.length;
    return parseProblemBlock(match[1].trim(), content.slice(start, end).trim(), problemNumber(match[1], arrayIndex + 1), options.setId);
  });
}

export type PracticeValidation = { valid: boolean; issues: string[]; review: "format-only" };

export function hasUnclosedPracticeMarkup(content: string) {
  const withoutCode = content.replace(/```[\s\S]*?```/g, "");
  if ((content.match(/```/g)?.length ?? 0) % 2) return true;
  const displays = withoutCode.match(/(?<!\\)\$\$/g)?.length ?? 0;
  const inline = withoutCode.replace(/(?<!\\)\$\$/g, "").match(/(?<!\\)\$/g)?.length ?? 0;
  return displays % 2 !== 0 || inline % 2 !== 0;
}

/** Field/format validation cannot establish the correctness of physics answers. */
export function validatePracticeProblem(
  problem: ParsedPracticeProblem,
  mode: import("@/types/learning").PracticeOutputMode = "hidden-answer",
  strict = true,
): PracticeValidation {
  const required: PracticeField[] = ["problem"];
  if (strict) required.push("trainingGoal", "knowledge", "difficulty", "conditions");
  if (mode !== "questions-only") required.push("hint");
  if (mode === "full-solution" || mode === "hidden-answer") required.push("solution", "answer");
  const issues = required.filter((field) => !problem[field]?.trim() || (strict && !problem.presentFields.includes(field))).map((field) => `missing_${field}`);
  if (problem.problem.trim().length < 12) issues.push("incomplete_problem");
  if (hasUnclosedPracticeMarkup(problem.rawContent)) issues.push("unclosed_markup");
  if (mode === "questions-only" && (problem.answer || problem.solution || problem.hint)) issues.push("unexpected_answer_fields");
  if (mode === "questions-hints" && (problem.answer || problem.solution)) issues.push("unexpected_answer_fields");
  return { valid: issues.length === 0, issues, review: "format-only" };
}

export function canonicalPracticeProblem(problem: ParsedPracticeProblem, id: string, index: number) {
  const title = problem.title.replace(/^(Problem|题目)\s*[0-9一二三四五六七八九十]+/i, `$1 ${index}`);
  const body = problem.rawContent.slice(problem.rawContent.indexOf("\n") + 1).replace(/<!--\s*pla:problem-id\s+[^>]+-->/g, "").trim();
  return `### ${title}\n<!-- pla:problem-id ${id} -->\n\n${body}`;
}
