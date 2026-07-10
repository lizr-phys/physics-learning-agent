import { isPhysicsIntent } from "@/agent/intent-classifier";
import { isPhysicsLikeQuery } from "@/lib/query-classifier";
import type {
  AgentIntent,
  AgentRequest,
  KnowledgeMode,
  PersonalKnowledgeDecision,
  QueryType,
} from "@/types/learning";

const explicitKnowledgeTerms = [
  "my notes",
  "my note",
  "my uploaded",
  "uploaded file",
  "uploaded document",
  "uploaded pdf",
  "this pdf",
  "the pdf",
  "this document",
  "the document",
  "this handout",
  "lecture notes",
  "course notes",
  "courseware",
  "slides",
  "problem set",
  "worksheet",
  "according to my",
  "based on my",
  "from my knowledge base",
  "use my knowledge base",
  "personal knowledge",
  "personal library",
  "notes i uploaded",
  "file i uploaded",
  "我上传",
  "上传的",
  "我的笔记",
  "我的讲义",
  "我的课件",
  "我的教材",
  "我的资料",
  "个人知识库",
  "知识库",
  "这份资料",
  "这份文档",
  "这个文档",
  "这份 pdf",
  "这个 pdf",
  "这页",
  "这一页",
  "这道题",
  "这份试题",
  "这份课件",
  "按这份",
  "根据这份",
  "结合我的",
  "参考我的",
  "参考上传",
];

const contextDependentTerms = [
  "this section",
  "this page",
  "this paragraph",
  "this formula",
  "this derivation",
  "this problem",
  "the above notes",
  "continue from the notes",
  "explain this part",
  "why does it say",
  "make one from these notes",
  "这段",
  "这里",
  "这个公式",
  "这个推导",
  "上一段",
  "上面",
  "继续按这个",
  "按刚才的资料",
  "根据刚才",
  "这里为什么",
];

const generalNonKnowledgeTerms = [
  "resume",
  "email",
  "travel",
  "recipe",
  "weather",
  "relationship",
  "租房",
  "简历",
  "邮件",
  "做饭",
  "天气",
];

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function hasPersonalLibraryReferenceInHistory(input: AgentRequest) {
  return (input.history ?? []).some((message) => {
    const content = message.content.toLowerCase();
    return (
      content.includes("personal library /") ||
      content.includes("personal knowledge") ||
      content.includes("personal knowledge base") ||
      content.includes("uploaded document") ||
      content.includes("个人知识库")
    );
  });
}

function compactRetrievalQuery(input: AgentRequest) {
  const parts = [
    input.message,
    input.knowledgePoint,
    input.memory?.currentKnowledgePoint,
    input.memory?.currentGoal,
  ].filter(Boolean);

  return parts.join("\n").slice(0, 1_200);
}

export function resolveKnowledgeMode(value?: KnowledgeMode): KnowledgeMode {
  return value === "always" || value === "never" ? value : "auto";
}

export function decidePersonalKnowledgeUse(input: {
  request: AgentRequest;
  mode?: KnowledgeMode;
  intent: AgentIntent;
  queryType: QueryType;
  hasUser: boolean;
}): PersonalKnowledgeDecision {
  const mode = resolveKnowledgeMode(input.mode);

  if (!input.hasUser) {
    return {
      mode,
      shouldUse: false,
      confidence: "high",
      reason: "No signed-in user is available, so there is no personal knowledge base to search.",
    };
  }

  if (mode === "always") {
    return {
      mode,
      shouldUse: true,
      confidence: "high",
      reason: "The user selected Always use personal knowledge.",
      retrievalQuery: compactRetrievalQuery(input.request),
    };
  }

  if (mode === "never") {
    return {
      mode,
      shouldUse: false,
      confidence: "high",
      reason: "The user selected Do not use personal knowledge.",
    };
  }

  const text = input.request.message.toLowerCase();

  if (includesAny(text, explicitKnowledgeTerms)) {
    return {
      mode,
      shouldUse: true,
      confidence: "high",
      reason: "The message explicitly refers to uploaded notes, documents, files, or the personal knowledge base.",
      retrievalQuery: compactRetrievalQuery(input.request),
    };
  }

  if (
    hasPersonalLibraryReferenceInHistory(input.request) &&
    includesAny(text, contextDependentTerms)
  ) {
    return {
      mode,
      shouldUse: true,
      confidence: "medium",
      reason: "The message is a context-dependent follow-up to a prior answer that used personal knowledge.",
      retrievalQuery: compactRetrievalQuery(input.request),
    };
  }

  if (!isPhysicsIntent(input.intent) && includesAny(text, generalNonKnowledgeTerms)) {
    return {
      mode,
      shouldUse: false,
      confidence: "high",
      reason: "The message is a general non-physics request and does not ask for uploaded materials.",
    };
  }

  if (
    (isPhysicsIntent(input.intent) || isPhysicsLikeQuery(input.queryType)) &&
    includesAny(text, contextDependentTerms) &&
    (input.request.knowledgePoint ||
      input.request.memory?.currentKnowledgePoint ||
      input.request.memory?.currentGoal)
  ) {
    return {
      mode,
      shouldUse: true,
      confidence: "medium",
      reason: "The message is a physics-learning follow-up with an active topic context.",
      retrievalQuery: compactRetrievalQuery(input.request),
    };
  }

  return {
    mode,
    shouldUse: false,
    confidence: "low",
    reason: "The message does not clearly require user-uploaded materials.",
  };
}
