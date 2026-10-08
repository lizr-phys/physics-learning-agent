const protectedMarkdownPattern = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*(?:`|$))/g;

export function ensureBlockMath(input: string) {
  const text = input.trim();

  if (text.startsWith("$$") || text.startsWith("\\[")) {
    return text;
  }

  if (text.startsWith("$") && text.endsWith("$") && text.length > 2) {
    return `$$\n${text.slice(1, -1).trim()}\n$$`;
  }

  if (text.startsWith("\\(") && text.endsWith("\\)")) {
    return `$$\n${text.slice(2, -2).trim()}\n$$`;
  }

  return `$$\n${text}\n$$`;
}

function normalizeMathEnvironments(content: string) {
  return content
    .replace(
      /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g,
      (_, body: string) => `$$\n${body.trim()}\n$$`,
    )
    .replace(
      /\\begin\{(?:align|align\*|gather|gather\*|multline|multline\*)\}([\s\S]*?)\\end\{(?:align|align\*|gather|gather\*|multline|multline\*)\}/g,
      (_, body: string) => `$$\n\\begin{aligned}\n${body.trim()}\n\\end{aligned}\n$$`,
    );
}

function normalizeTextSegment(content: string) {
  const delimited = content
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/\\\(/g, () => "$")
    .replace(/\\\)/g, () => "$");
  // Protect existing math, including an unfinished streaming block, before
  // repairing recognizable bare environments or equation tags.
  return delimited.split(/((?<!\\)\$\$[\s\S]*?(?:\$\$|$)|(?<!\\)\$(?:\\.|[^$\n])*(?:\$|$))/g)
    .map(part => {
      if (part.startsWith("$")) return part.replace(/\\(begin|end)\{(?:align|align\*|gather|gather\*)\}/g, "\\$1{aligned}");
      return normalizeMathEnvironments(part).split(/((?<!\\)\$\$[\s\S]*?(?:\$\$|$)|(?<!\\)\$(?:\\.|[^$\n])*(?:\$|$))/g).map(segment => {
        if (segment.startsWith("$")) return segment;
        return segment.split("\n").map((line) => {
      const trimmed = line.trim();
      const hasNakedTag = /\\tag\{[^}]+\}/.test(trimmed);
      const alreadyMath = trimmed.startsWith("$");

      if (hasNakedTag && !alreadyMath) {
        return `$$\n${trimmed}\n$$`;
      }

      return line;
        }).join("\n");
      }).join("");
    }).join("");
}

function countMathDelimiters(content: string) {
  let block = 0;
  let inline = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "$" || content[index - 1] === "\\") {
      continue;
    }

    if (content[index + 1] === "$") {
      block += 1;
      index += 1;
    } else {
      inline += 1;
    }
  }

  return { block, inline };
}

function closeStreamingMath(content: string) {
  const counts = content
    .split(protectedMarkdownPattern)
    .filter((part) => !part.startsWith("```") && !part.startsWith("~~~") && !part.startsWith("`"))
    .reduce(
      (total, part) => {
        const next = countMathDelimiters(part);
        return {
          block: total.block + next.block,
          inline: total.inline + next.inline,
        };
      },
      { block: 0, inline: 0 },
    );

  if (counts.block % 2 === 1) {
    return `${content}\n$$`;
  }

  if (counts.inline % 2 === 1) {
    return `${content}$`;
  }

  return content;
}

export function normalizeMarkdownMath(content: string, streaming = false) {
  const normalized = content
    .replace(/\r\n?/g, "\n")
    .split(protectedMarkdownPattern)
    .map((part) => {
      if (part.startsWith("```") || part.startsWith("~~~") || part.startsWith("`")) {
        return part;
      }

      return normalizeTextSegment(part);
    })
    .join("");

  return streaming ? closeStreamingMath(normalized) : normalized;
}
