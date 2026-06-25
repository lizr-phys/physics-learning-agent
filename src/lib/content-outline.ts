export type OutlineItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

export function createContentScope(content: string) {
  let hash = 0;

  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

export function createHeadingId(title: string, index = 0, scope = "content") {
  const normalized = title
    .toLowerCase()
    .replace(/[`*_~[\](){}<>]/g, "")
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return `section-${scope}-${normalized || "content"}-${index}`;
}

export function extractContentOutline(content: string): OutlineItem[] {
  const scope = createContentScope(content);

  return content
    .split(/(```[\s\S]*?```)/g)
    .filter((part) => !part.startsWith("```"))
    .join("")
    .split(/\r?\n/)
    .map((line) => line.match(/^(##|###)\s+(.+?)\s*#*\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match, index) => ({
      id: createHeadingId(match[2].trim(), index, scope),
      title: match[2].trim(),
      level: match[1].length as 2 | 3,
    }));
}
