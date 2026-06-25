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
  题型来源风格: "sourceStyle",
  训练目标: "trainingGoal",
  题目: "problem",
  涉及知识点: "knowledge",
  难度: "difficulty",
  提示: "hint",
  解析: "solution",
  详细解析: "solution",
  答案: "answer",
  最终答案: "answer",
};

function parseProblemBlock(title: string, content: string, index: number): ParsedPracticeProblem {
  const fields: Partial<ParsedPracticeProblem> = {};
  let activeField: keyof typeof fields | null = null;

  for (const line of content.split(/\r?\n/)) {
    const label = line.match(/^\*\*(题型来源风格|训练目标|题目|涉及知识点|难度|提示|解析|详细解析|答案|最终答案)\*\*[：:]\s*(.*)$/);

    if (label) {
      activeField = labelMap[label[1]];
      fields[activeField] = label[2].trim();
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
    content.matchAll(/^###\s*(题目\s*[0-9一二三四五六七八九十]+[^\n]*)$/gim),
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
