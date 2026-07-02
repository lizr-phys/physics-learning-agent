export type ParsedPracticeProblem = {
  index: number;
  title: string;
  sourceStyle?: string;
  trainingGoal?: string;
  knowledge?: string;
  difficulty?: string;
  problem: string;
  hint?: string;
  solution?: string;
  answer?: string;
  rawContent: string;
};

const labelMap: Record<string, keyof Omit<ParsedPracticeProblem, "index" | "title" | "rawContent">> = {
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
};

const fieldPattern =
  /^\*\*([^*]+)\*\*\s*[:：]\s*(.*)$/;

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseProblemBlock(title: string, content: string, index: number): ParsedPracticeProblem {
  const fields: Partial<ParsedPracticeProblem> = {};
  let activeField: keyof typeof fields | null = null;

  for (const line of content.split(/\r?\n/)) {
    const label = line.match(fieldPattern);

    if (label) {
      activeField = labelMap[normalizeLabel(label[1])] ?? null;

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
    index,
    title,
    sourceStyle: fields.sourceStyle,
    trainingGoal: fields.trainingGoal,
    knowledge: fields.knowledge,
    difficulty: fields.difficulty,
    problem: fields.problem || content,
    hint: fields.hint,
    solution: fields.solution,
    answer: fields.answer,
    rawContent: `### ${title}\n${content}`.trim(),
  };
}

export function parsePracticeProblems(content: string): ParsedPracticeProblem[] {
  const matches = Array.from(
    content.matchAll(/^###\s*((?:Problem|题目)\s*[0-9一二三四五六七八九十]+[^\n]*)$/gim),
  );

  if (!matches.length) {
    return [];
  }

  return matches.map((match, arrayIndex) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[arrayIndex + 1]?.index ?? content.length;
    return parseProblemBlock(match[1].trim(), content.slice(start, end).trim(), arrayIndex + 1);
  });
}
