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

export type PracticeAssessmentStatus = "solved" | "needs-work";

export type PracticeAssessment = {
  status: PracticeAssessmentStatus;
  attemptDraft?: string;
  stuckNote?: string;
  updatedAt: number;
};

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

export type ContextProvenance = Partial<Record<
  "course" | "knowledgePoint" | "language" | "practiceStyle" | "referenceProfile",
  { source: "current-input" | "current-selection" | "history" | "default"; updatedAt: number }
>>;

export type ContextBudget = {
  charBudget: number;
  usedChars: number;
  estimatedTokens: number;
  omittedMessages: number;
};

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
  status?: "disabled" | "unauthenticated" | "no_match" | "retrieved" | "failed";
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
  contextProvenance?: ContextProvenance;
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

export type AnswerFeedbackIssue =
  | "unclear"
  | "formula-error"
  | "citation-error"
  | "other";

export type AnswerFeedback = {
  verdict: "helpful" | "needs-improvement";
  issue?: AnswerFeedbackIssue;
  updatedAt: number;
};

export type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  images?: ImageAttachment[];
  createdAt?: number;
  status?: "streaming" | "complete" | "interrupted" | "error";
  requestId?: string;
  feedback?: AnswerFeedback;
  feedbackDeletedAt?: number;
  sources?: RagContext["snippets"];
  retrievalStatus?: RetrievalStatus;
  generation?: GenerationDiagnostics;
  generationAttempts?: GenerationDiagnostics[];
};

export type ImageAttachment = {
  id: string;
  name: string;
  mimeType: "image/webp";
  size: number;
  width: number;
  height: number;
};

export type RetrievalStatus = "disabled" | "unauthenticated" | "no_match" | "retrieved" | "failed";
export type TokenUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
export type GenerationDiagnostics = {
  requestId: string;
  provider?: string;
  model?: string;
  intent?: AgentIntent;
  terminal: "complete" | "truncated" | "interrupted" | "cancelled" | "error";
  reason?: string;
  finishReason?: string;
  startedAt?: number;
  durationMs?: number;
  firstTokenMs?: number;
  outputChars?: number;
  usage?: TokenUsage;
};

export type ToolContext = {
  source: "practice" | "knowledge";
  course?: CourseId;
  knowledgeId?: string;
  knowledgeTitle?: string;
  topic?: string;
  taskTitle?: string;
  userInput?: string;
  generatedContent: string;
  images?: ImageAttachment[];
  selectedItem?: {
    type: "problem" | "summary";
    title?: string;
    content?: string;
    index?: number;
  };
  createdAt: number;
};

export type RagCitation = {
  sourceId?: string;
  documentId?: string;
  contentHash?: string;
  version?: number;
  source: string;
  heading: string;
  kind?: "personal" | "sample";
  locator?: string;
};

export type RagContext = {
  snippets: Array<RagCitation & { content: string }>;
  status?: "disabled" | "unauthenticated" | "no_match" | "retrieved" | "failed";
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
  images?: ImageAttachment[];
  /** Server-resolved private image bytes. Never accepted from a public request or persisted in a snapshot. */
  resolvedImages?: Record<string, { mimeType: "image/webp"; data: string }>;
  practiceTask?: { setId: string; resumeContent?: string };
  intent?: AgentIntent;
  queryType?: QueryType;
  module?: AgentModule;
  course?: CourseId;
  taskType?: TaskTypeId;
  knowledgePoint?: string;
  difficulty?: DifficultyId;
  exerciseCount?: number;
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
  knowledgeDocumentIds?: string[];
  knowledgeCourseOnly?: boolean;
  personalKnowledgeDecision?: PersonalKnowledgeDecision;
  clientProvider?: ClientProviderConfig;
  conversationId?: string;
  assistantMessageId?: string;
  requestId?: string;
  authEpoch?: string;
  contextProvenance?: ContextProvenance;
  contextBudget?: ContextBudget;
};

export type AgentResponse = {
  content: string;
};
