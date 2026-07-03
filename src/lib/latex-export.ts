export type LatexDocumentOptions = {
  title?: string;
  subtitle?: string;
  author?: string;
  generatedAt?: Date;
};

const codeFencePattern = /^\s*(```|~~~)/;
const unorderedListPattern = /^\s*[-*+]\s+(.+)$/;
const orderedListPattern = /^\s*\d+[.)]\s+(.+)$/;
const boldFieldPattern = /^\*\*([^*]+)\*\*\s*:\s*(.*)$/;
const headingPattern = /^(#{1,6})\s+(.+)$/;
type ListType = "" | "itemize" | "enumerate";

function escapeLatexText(input: string) {
  return input
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function stripInlineMarkdown(input: string) {
  return input
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

function normalizeMathDelimiters(input: string) {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(
      /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g,
      (_, body: string) => `$$\n${body.trim()}\n$$`,
    )
    .replace(
      /\\begin\{(?:align|align\*|gather|gather\*|multline|multline\*)\}([\s\S]*?)\\end\{(?:align|align\*|gather|gather\*|multline|multline\*)\}/g,
      (_, body: string) => `$$\n\\begin{aligned}\n${body.trim()}\n\\end{aligned}\n$$`,
    )
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      if (/\\tag\{[^}]+\}/.test(trimmed) && !trimmed.startsWith("$")) {
        return `$$\n${trimmed}\n$$`;
      }

      return line;
    })
    .join("\n");
}

function escapeInlineTextWithMath(input: string) {
  const normalized = stripInlineMarkdown(input);
  const parts = normalized.split(/(\$[^$\n]+\$)/g);

  return parts
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$")) {
        return part;
      }

      return escapeLatexText(part);
    })
    .join("");
}

function headingCommand(level: number) {
  if (level <= 1) return "\\section*";
  if (level === 2) return "\\section*";
  if (level === 3) return "\\subsection*";
  return "\\subsubsection*";
}

function dateLine(date?: Date) {
  if (!date) return "\\today";

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function closeList(lines: string[], currentList: ListType): ListType {
  if (!currentList) return "";

  lines.push(`\\end{${currentList}}`);
  return "";
}

function openListIfNeeded(
  lines: string[],
  currentList: ListType,
  nextList: Exclude<ListType, "">,
) {
  if (currentList === nextList) {
    return currentList;
  }

  closeList(lines, currentList);
  lines.push(`\\begin{${nextList}}`);
  return nextList;
}

function convertMarkdownBodyToLatex(markdown: string) {
  const source = normalizeMathDelimiters(markdown);
  const output: string[] = [];
  let inCodeBlock = false;
  let inDisplayMath = false;
  let currentList: ListType = "";

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (codeFencePattern.test(trimmed)) {
      currentList = closeList(output, currentList) as typeof currentList;
      output.push(inCodeBlock ? "\\end{verbatim}" : "\\begin{verbatim}");
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      output.push(line);
      continue;
    }

    if (trimmed === "$$") {
      currentList = closeList(output, currentList) as typeof currentList;
      output.push(inDisplayMath ? "\\]" : "\\[");
      inDisplayMath = !inDisplayMath;
      continue;
    }

    if (inDisplayMath) {
      output.push(line);
      continue;
    }

    if (!trimmed) {
      currentList = closeList(output, currentList) as typeof currentList;
      output.push("");
      continue;
    }

    const singleLineDisplay = trimmed.match(/^\$\$(.*)\$\$$/);
    if (singleLineDisplay) {
      currentList = closeList(output, currentList) as typeof currentList;
      output.push("\\[");
      output.push(singleLineDisplay[1].trim());
      output.push("\\]");
      continue;
    }

    const heading = trimmed.match(headingPattern);
    if (heading) {
      currentList = closeList(output, currentList) as typeof currentList;
      const level = heading[1].length;
      output.push(`${headingCommand(level)}{${escapeInlineTextWithMath(heading[2])}}`);
      continue;
    }

    const unordered = trimmed.match(unorderedListPattern);
    if (unordered) {
      currentList = openListIfNeeded(output, currentList, "itemize");
      output.push(`  \\item ${escapeInlineTextWithMath(unordered[1])}`);
      continue;
    }

    const ordered = trimmed.match(orderedListPattern);
    if (ordered) {
      currentList = openListIfNeeded(output, currentList, "enumerate");
      output.push(`  \\item ${escapeInlineTextWithMath(ordered[1])}`);
      continue;
    }

    const field = trimmed.match(boldFieldPattern);
    if (field) {
      currentList = closeList(output, currentList) as typeof currentList;
      const label = escapeInlineTextWithMath(field[1].trim());
      const value = escapeInlineTextWithMath(field[2].trim());
      output.push(`\\paragraph{${label}.} ${value}`);
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      currentList = closeList(output, currentList) as typeof currentList;
      output.push("\\begin{verbatim}");
      output.push(line);
      output.push("\\end{verbatim}");
      continue;
    }

    currentList = closeList(output, currentList) as typeof currentList;
    output.push(escapeInlineTextWithMath(trimmed));
  }

  closeList(output, currentList);

  if (inDisplayMath) {
    output.push("\\]");
  }

  if (inCodeBlock) {
    output.push("\\end{verbatim}");
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildLatexDocument(markdown: string, options: LatexDocumentOptions = {}) {
  const title = options.title ?? "Physics Learning Agent Practice Problems";
  const subtitle = options.subtitle?.trim();
  const body = convertMarkdownBodyToLatex(markdown);

  return [
    "% Generated by Physics Learning Agent",
    "% Compile with XeLaTeX or LuaLaTeX. The ctexart class supports Chinese and English content.",
    "\\documentclass[11pt]{ctexart}",
    "\\usepackage[a4paper,margin=2.5cm]{geometry}",
    "\\usepackage{amsmath,amssymb,mathtools,bm}",
    "\\usepackage{enumitem}",
    "\\usepackage{hyperref}",
    "\\usepackage{xcolor}",
    "\\setlist{nosep,leftmargin=2em}",
    "\\hypersetup{colorlinks=true,linkcolor=black,urlcolor=black,citecolor=black}",
    "\\allowdisplaybreaks",
    "\\sloppy",
    `\\title{${escapeLatexText(title)}}`,
    `\\author{${escapeLatexText(options.author ?? "Physics Learning Agent")}}`,
    `\\date{${escapeLatexText(dateLine(options.generatedAt))}}`,
    "\\begin{document}",
    "\\maketitle",
    subtitle ? `\\begin{center}\\small ${escapeInlineTextWithMath(subtitle)}\\end{center}` : "",
    subtitle ? "\\vspace{1em}" : "",
    body,
    "\\end{document}",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function createTexFileName(topic?: string) {
  const base = (topic || "physics-practice-problems")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "physics-practice-problems"}.tex`;
}
