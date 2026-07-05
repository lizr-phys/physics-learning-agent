import type { RagChunk, RagDocument } from "@/rag/types";

const tokenPattern = /[\p{Script=Han}A-Za-z0-9_\-]+/gu;

export function tokenize(text: string) {
  return Array.from(text.toLowerCase().matchAll(tokenPattern), (match) => match[0]).filter(
    (token) => token.length > 1,
  );
}

function splitByHeading(content: string) {
  const lines = content.split(/\r?\n/);
  const sections: Array<{ heading: string; content: string[] }> = [];
  let current = { heading: "Untitled", content: [] as string[] };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (headingMatch) {
      if (current.content.join("\n").trim()) {
        sections.push(current);
      }
      current = { heading: headingMatch[2].trim(), content: [] };
    } else {
      current.content.push(line);
    }
  }

  if (current.content.join("\n").trim()) {
    sections.push(current);
  }

  return sections;
}

function splitLongText(text: string, maxChars: number) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    if ((buffer + "\n\n" + paragraph).length > maxChars && buffer) {
      chunks.push(buffer.trim());
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

export function chunkMarkdownDocument(document: RagDocument, maxChars = 900): RagChunk[] {
  return splitByHeading(document.content).flatMap((section, sectionIndex) =>
    splitLongText(section.content.join("\n"), maxChars).map((content, chunkIndex) => ({
      id: `${document.source}:${sectionIndex}:${chunkIndex}`,
      source: document.source,
      heading: section.heading,
      content,
      tokens: tokenize(`${section.heading}\n${content}`),
    })),
  );
}
