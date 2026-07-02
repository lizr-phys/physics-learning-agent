import { getCourseContext, getCourseLabel } from "@/data/courses";
import { getKnowledgeItem, getRelatedKnowledgeItems } from "@/data/knowledge";
import type { AgentRequest, KnowledgeItem } from "@/types/learning";

function listOrNone(items: string[] | undefined) {
  return items?.length ? items.join("; ") : "None specified";
}

export function formatKnowledgeBrief(item: KnowledgeItem) {
  return [
    `Topic: ${item.title}`,
    item.alias?.length ? `Aliases: ${item.alias.join("; ")}` : "",
    `Short description: ${item.description}`,
    `Textbook-style note: ${item.textbookStyleSummary}`,
    `Prerequisites: ${listOrNone(item.prerequisites)}`,
    `Related topics: ${listOrNone(item.related)}`,
    `Typical problems: ${listOrNone(item.typicalProblems)}`,
    item.keyFormulas?.length ? `Key formulas: ${item.keyFormulas.join("; ")}` : "",
    item.commonMisunderstandings?.length
      ? `Common pitfalls: ${item.commonMisunderstandings.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildKnowledgeContext(input: AgentRequest) {
  const courseLabel = getCourseLabel(input.course);
  const courseContext = getCourseContext(input.course);
  const selected = getKnowledgeItem(input.knowledgePoint);

  if (!selected) {
    return [
      `Course: ${courseLabel}`,
      courseContext ? `Course scope: ${courseContext}` : "",
      "No specific topic is selected. Use only course-level context and do not assume a chapter unless the user names it.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const related = getRelatedKnowledgeItems(selected)
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.description}`);

  return [
    `Course: ${courseLabel}`,
    formatKnowledgeBrief(selected),
    related.length ? `Related context hints:\n${related.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const buildCompactKnowledgeContext = buildKnowledgeContext;
