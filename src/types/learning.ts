export type CourseId =
  | "general"
  | "general-physics"
  | "math-physics"
  | "theoretical-mechanics"
  | "electrodynamics"
  | "quantum-mechanics"
  | "thermo-stat";

export const taskTypeOptions = [
  { id: "qa", label: "普通问答" },
  { id: "explain", label: "知识点解释" },
  { id: "derivation", label: "标准推导" },
  { id: "section-review", label: "板块复习" },
  { id: "problem-types", label: "题型梳理" },
  { id: "practice", label: "练习题生成" },
  { id: "solution-guide", label: "解题指导" },
  { id: "misconceptions", label: "易错点分析" },
  { id: "review-plan", label: "复习计划" },
] as const;

export type TaskTypeId = (typeof taskTypeOptions)[number]["id"];

export const difficultyOptions = [
  { id: "basic", label: "基础" },
  { id: "medium", label: "中等" },
  { id: "advanced", label: "提高" },
  { id: "exam", label: "考研或竞赛风格" },
] as const;

export type DifficultyId = (typeof difficultyOptions)[number]["id"];

export type KnowledgeDifficulty = "basic" | "intermediate" | "advanced";

export type KnowledgeItem = {
  id: string;
  course: CourseId;
  title: string;
  alias?: string[];
  description: string;
  textbookStyleSummary: string;
  prerequisites: string[];
  related: string[];
  typicalProblems: string[];
  keyFormulas?: string[];
  commonMisunderstandings?: string[];
  studyOrder: number;
  difficulty: KnowledgeDifficulty;
  tags: string[];
};

export type ChatRole = "user" | "assistant";

export type QueryType =
  | "physics_core"
  | "math_physics_support"
  | "coding"
  | "daily_life"
  | "writing"
  | "other";

export type AgentIntent =
  | "physics_learning"
  | "exercise_generation"
  | "study_planning"
  | "general_question"
  | "meta_question";

export type AgentModule = "chat" | "practice" | "review" | "types";

export const answerDepthOptions = [
  { id: "concise", label: "简洁" },
  { id: "standard", label: "标准" },
  { id: "detailed", label: "详细" },
  { id: "derivation-first", label: "推导优先" },
  { id: "problem-type-first", label: "题型优先" },
] as const;

export type AnswerDepth = (typeof answerDepthOptions)[number]["id"];

export const practiceOutputModeOptions = [
  { id: "questions-only", label: "只生成题目" },
  { id: "questions-hints", label: "题目 + 提示" },
  { id: "full-solution", label: "题目 + 详细解析" },
  { id: "hidden-answer", label: "题目 + 提示，答案默认隐藏" },
] as const;

export type PracticeOutputMode = (typeof practiceOutputModeOptions)[number]["id"];

export type LearningMemory = {
  currentCourse?: CourseId;
  currentKnowledgePoint?: string;
  currentGoal?: string;
  recentConfusions: string[];
  coveredConcepts: string[];
  exerciseTopics: string[];
  preferredStyle: "balanced" | "step-by-step" | "concise";
  conversationSummary?: string;
  updatedAt: number;
};

export type LearningProfile = {
  courseFrequency: Partial<Record<CourseId, number>>;
  recentTopics: string[];
  preferredStyle: LearningMemory["preferredStyle"];
  updatedAt: number;
};

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  createdAt?: number;
  status?: "streaming" | "complete" | "interrupted" | "error";
  requestId?: string;
};

export type ToolContext = {
  source: "review" | "practice" | "types";
  course?: CourseId;
  knowledgeId?: string;
  knowledgeTitle?: string;
  topic?: string;
  taskTitle?: string;
  userInput?: string;
  generatedContent: string;
  selectedItem?: {
    type: "section" | "problem" | "problemType" | "summary";
    title?: string;
    content?: string;
    index?: number;
  };
  createdAt: number;
};

export type RagCitation = {
  source: string;
  heading: string;
};

export type RagContext = {
  snippets: Array<RagCitation & { content: string }>;
};

export type AgentRequest = {
  message: string;
  intent?: AgentIntent;
  queryType?: QueryType;
  module?: AgentModule;
  course?: CourseId;
  taskType?: TaskTypeId;
  knowledgePoint?: string;
  difficulty?: DifficultyId;
  exerciseCount?: 3 | 5 | 10;
  includeAnswer?: boolean;
  includeSolution?: boolean;
  includeHint?: boolean;
  useRag?: boolean;
  ragContext?: RagContext;
  toolContext?: ToolContext;
  model?: string;
  history?: ChatMessage[];
  memory?: LearningMemory;
  answerDepth?: AnswerDepth;
  practiceOutputMode?: PracticeOutputMode;
  conversationId?: string;
  assistantMessageId?: string;
  requestId?: string;
};

export type AgentResponse = {
  content: string;
};
