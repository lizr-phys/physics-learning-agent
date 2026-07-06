export type CourseId =
  | "general"
  | "general-physics"
  | "math-physics"
  | "theoretical-mechanics"
  | "electrodynamics"
  | "quantum-mechanics"
  | "thermo-stat";

export const taskTypeOptions = [
  { id: "qa", label: "Q&A" },
  { id: "explain", label: "Concept explanation" },
  { id: "derivation", label: "Derivation" },
  { id: "practice", label: "Practice problems" },
  { id: "solution-guide", label: "Solution guidance" },
  { id: "misconceptions", label: "Misconceptions" },
  { id: "study-plan", label: "Study plan" },
] as const;

export type TaskTypeId = (typeof taskTypeOptions)[number]["id"];

export const difficultyOptions = [
  { id: "basic", label: "Basic" },
  { id: "medium", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
  { id: "exam", label: "Exam style" },
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

export type AgentModule = "chat" | "practice";

export const answerDepthOptions = [
  { id: "concise", label: "Concise" },
  { id: "standard", label: "Standard" },
  { id: "detailed", label: "Detailed" },
  { id: "derivation-first", label: "Derivation first" },
  { id: "problem-type-first", label: "Problem style first" },
] as const;

export type AnswerDepth = (typeof answerDepthOptions)[number]["id"];

export const practiceOutputModeOptions = [
  { id: "questions-only", label: "Questions only" },
  { id: "questions-hints", label: "Questions + hints" },
  { id: "full-solution", label: "Questions + full solutions" },
  { id: "hidden-answer", label: "Questions + hidden answers" },
] as const;

export type PracticeOutputMode = (typeof practiceOutputModeOptions)[number]["id"];

export const practiceStyleOptions = [
  { id: "auto", label: "Auto" },
  { id: "chinese-textbook", label: "Chinese textbook exercises" },
  { id: "chinese-final-exam", label: "Chinese final exam" },
  { id: "chinese-postgraduate-exam", label: "Chinese postgraduate entrance exam" },
  { id: "english-textbook", label: "English textbook exercises" },
  { id: "open-course", label: "Open-course problem set" },
] as const;

export type PracticeStyleId = (typeof practiceStyleOptions)[number]["id"];

export type DetectedLanguage = "zh" | "en";

export type ReferenceProfileId = "auto" | "chinese" | "english";

export const knowledgeModeOptions = [
  { id: "auto", label: "Auto" },
  { id: "always", label: "Always use personal knowledge" },
  { id: "never", label: "Do not use personal knowledge" },
] as const;

export type KnowledgeMode = (typeof knowledgeModeOptions)[number]["id"];

export type PersonalKnowledgeDecision = {
  mode: KnowledgeMode;
  shouldUse: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
  retrievalQuery?: string;
};

export type LearningMemory = {
  currentCourse?: CourseId;
  currentKnowledgePoint?: string;
  currentGoal?: string;
  recentLanguage?: DetectedLanguage;
  practiceStyle?: PracticeStyleId;
  referenceProfile?: ReferenceProfileId;
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
  recentLanguage?: DetectedLanguage;
  practiceStyle?: PracticeStyleId;
  referenceProfile?: ReferenceProfileId;
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
  source: "practice";
  course?: CourseId;
  knowledgeId?: string;
  knowledgeTitle?: string;
  topic?: string;
  taskTitle?: string;
  userInput?: string;
  generatedContent: string;
  selectedItem?: {
    type: "problem" | "summary";
    title?: string;
    content?: string;
    index?: number;
  };
  createdAt: number;
};

export type RagCitation = {
  source: string;
  heading: string;
  kind?: "personal" | "sample";
};

export type RagContext = {
  snippets: Array<RagCitation & { content: string }>;
};

export type ClientProviderKind = "openai-compatible" | "anthropic" | "gemini";

export type ClientProviderId =
  | "openai"
  | "deepseek"
  | "qwen"
  | "kimi"
  | "glm"
  | "openrouter"
  | "anthropic"
  | "gemini"
  | "custom";

export type ClientProviderConfig = {
  provider: ClientProviderId;
  type: ClientProviderKind;
  label?: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
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
  practiceStyle?: PracticeStyleId;
  detectedLanguage?: DetectedLanguage;
  referenceProfile?: ReferenceProfileId;
  knowledgeMode?: KnowledgeMode;
  personalKnowledgeDecision?: PersonalKnowledgeDecision;
  clientProvider?: ClientProviderConfig;
  conversationId?: string;
  assistantMessageId?: string;
  requestId?: string;
};

export type AgentResponse = {
  content: string;
};
