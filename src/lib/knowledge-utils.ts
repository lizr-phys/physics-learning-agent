import { getCourseContext, getCourseLabel } from "@/data/courses";
import { getKnowledgeItem, getRelatedKnowledgeItems } from "@/data/knowledge";
import type { AgentRequest, KnowledgeItem } from "@/types/learning";

function listOrNone(items: string[] | undefined) {
  return items?.length ? items.join("；") : "未列出";
}

export function formatKnowledgeBrief(item: KnowledgeItem) {
  return [
    `知识点：${item.title}`,
    item.alias?.length ? `别名：${item.alias.join("；")}` : "",
    `简要定义：${item.description}`,
    `教材式说明：${item.textbookStyleSummary}`,
    `前置知识：${listOrNone(item.prerequisites)}`,
    `关联知识：${listOrNone(item.related)}`,
    `常见题型：${listOrNone(item.typicalProblems)}`,
    item.keyFormulas?.length ? `常用公式：${item.keyFormulas.join("；")}` : "",
    item.commonMisunderstandings?.length
      ? `易错点：${item.commonMisunderstandings.join("；")}`
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
      `课程：${courseLabel}`,
      courseContext ? `课程范围：${courseContext}` : "",
      "未限定具体知识点。回答时只使用课程层面的上下文，不要假定用户已经指定章节。",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const related = getRelatedKnowledgeItems(selected)
    .slice(0, 3)
    .map((item) => `${item.title}：${item.description}`);

  return [
    `课程：${courseLabel}`,
    formatKnowledgeBrief(selected),
    related.length ? `相关知识提示：\n${related.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const buildCompactKnowledgeContext = buildKnowledgeContext;
