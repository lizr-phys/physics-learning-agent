import { buildCourseInstruction } from "@/data/courseInstructions";
import { getCourseLabel } from "@/data/courses";
import { buildAgentRoleInstruction } from "@/data/agentRoles";
import {
  buildSystemPrompt,
  forbiddenAnswerStyle,
  taskLengthHints,
  taskOutputTemplates,
} from "@/data/promptTemplates";
import {
  buildCourseReferenceInstruction,
  describePracticeStyle,
  referenceProfiles,
  resolvePracticeStyle,
  resolveReferenceProfile,
} from "@/data/referenceProfiles";
import { classifyAgentIntent, isPhysicsIntent } from "@/agent/intent-classifier";
import { formatLearningMemory } from "@/agent/memory-manager";
import { buildKnowledgeContext } from "@/lib/knowledge-utils";
import { detectLanguage, languageName } from "@/lib/language";
import { classifyQuery } from "@/lib/query-classifier";
import {
  difficultyOptions,
  type AnswerDepth,
  type AgentIntent,
  type AgentRequest,
  type DetectedLanguage,
  type QueryType,
  type ReferenceProfileId,
  type TaskTypeId,
} from "@/types/learning";

export const PHYSICS_TUTOR_SYSTEM_PROMPT = buildSystemPrompt();

const taskLabels: Record<TaskTypeId, string> = {
  qa: "Q&A",
  explain: "Concept explanation",
  derivation: "Derivation",
  practice: "Practice problem generation",
  "solution-guide": "Solution guidance",
  misconceptions: "Misconception analysis",
  "study-plan": "Study plan",
};

const queryTypeLabels: Record<QueryType, string> = {
  physics_core: "Core physics",
  math_physics_support: "Mathematical support for physics",
  coding: "Coding or data processing",
  daily_life: "Daily life or general study",
  writing: "Writing or communication",
  other: "General question",
};

const intentLabels: Record<AgentIntent, string> = {
  physics_learning: "Physics learning",
  exercise_generation: "Practice generation",
  study_planning: "Study planning",
  general_question: "General question",
  meta_question: "Assistant usage",
};

const toolSourceLabels = {
  practice: "Practice problems",
} as const;

function labelById<T extends readonly { id: string; label: string }[]>(items: T, id?: string) {
  return items.find((item) => item.id === id)?.label ?? "Unspecified";
}

const depthInstructions: Record<AnswerDepth, string> = {
  concise:
    "Concise: answer first, keep only the necessary definitions, formulas, and conditions.",
  standard:
    "Standard: include definition, necessary formulas, explanation, applicability, and common pitfalls.",
  detailed:
    "Detailed: include derivation reasons, examples, links to related topics, and checks without unrelated expansion.",
  "derivation-first":
    "Derivation first: emphasize assumptions, starting equations, step-by-step transformations, reasons, and result checks.",
  "problem-type-first":
    "Problem style first: emphasize condition recognition, modeling steps, common equations, variants, and pitfalls.",
};

export function buildAnswerDepthInstruction(depth?: AnswerDepth) {
  return depthInstructions[depth ?? "standard"];
}

function buildPracticeOutputInstruction(mode?: AgentRequest["practiceOutputMode"]) {
  switch (mode) {
    case "questions-only":
      return "Only output problem statements, source style, training goals, topics, and difficulty. Do not output hints, solutions, or answers.";
    case "questions-hints":
      return "Output problem statements and hints. Do not give full solutions or final answers.";
    case "full-solution":
      return "Output problem statements, hints, detailed solutions, and final answers.";
    case "hidden-answer":
      return "Output problem statements, hints, detailed solutions, and final answers. The frontend will fold solutions and answers by default.";
    default:
      return "Output the necessary problem statements, hints, solutions, and answers according to the task parameters.";
  }
}

export function buildTaskTemplate(taskType?: TaskTypeId) {
  return taskOutputTemplates[taskType ?? "qa"];
}

export function buildRagContext(input: AgentRequest) {
  const snippets = input.ragContext?.snippets ?? [];

  if (!snippets.length) {
    return input.useRag
      ? "Local knowledge retrieval was enabled, but no sufficiently relevant local snippets were found. Answer normally; if useful, say that the local notes did not cover the point."
      : "Local knowledge retrieval is not enabled.";
  }

  return `Relevant local note snippets are provided below. Use them when they are helpful, but do not copy long passages or invent page numbers. If the snippets are insufficient, say so briefly and supplement with basic physics knowledge.

${snippets
  .map(
    (snippet, index) =>
      `[${index + 1}] source: ${snippet.source}\ntitle: ${snippet.heading}\ncontent: ${snippet.content}`,
  )
  .join("\n\n")}

If local snippets are used, end with a short "References" list containing document names and snippet headings only.`;
}

function truncateContext(content: string, maxLength: number) {
  const normalized = content.replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}\n\n[Content truncated. Continue from the concrete context above.]`
    : normalized;
}

export function buildToolContext(input: AgentRequest) {
  const context = input.toolContext;

  if (!context) {
    return "No tool-page context is attached.";
  }

  const selected = context.selectedItem;
  const selectedBlock = selected?.content
    ? `Current follow-up target:\n- Type: ${selected.type}\n- Title: ${selected.title ?? "Untitled"}\n- Index: ${selected.index ?? "Unspecified"}\n\n${truncateContext(selected.content, 6000)}`
    : "";
  const generatedBlock = selectedBlock
    ? `Full generated material, summarized or truncated:\n${truncateContext(context.generatedContent, 3000)}`
    : `Generated material:\n${truncateContext(context.generatedContent, 6000)}`;

  return `The user is continuing from material generated on a tool page. If the current question refers to this material, use it as context rather than treating the turn as a fresh conversation.

Source: ${toolSourceLabels[context.source]}
Course: ${getCourseLabel(context.course)}
Topic: ${context.knowledgeTitle ?? context.knowledgeId ?? context.topic ?? "Unspecified"}
Original tool input: ${context.userInput ?? "Not recorded"}

${selectedBlock}

${generatedBlock}

Do not repeat the whole tool output unless the user asks to see it again.`;
}

function buildSessionMemory(input: AgentRequest) {
  const history = input.history ?? [];

  if (!history.length) {
    return "No previous messages.";
  }

  return history
    .slice(-16)
    .map((message, index) => {
      const role = message.role === "user" ? "User" : "Agent";
      return `${index + 1}. ${role}: ${truncateContext(message.content, 700)}`;
    })
    .join("\n");
}

function buildLearningContextSnapshot(input: AgentRequest) {
  const context = input.toolContext;
  const moduleName = context ? toolSourceLabels[context.source] : input.module ?? "chat";

  return [
    `Current module: ${moduleName}`,
    `Current course: ${getCourseLabel(input.course)}`,
    `Current task type: ${taskLabels[input.taskType ?? "qa"]}`,
    `Current topic: ${context?.knowledgeTitle ?? input.knowledgePoint ?? "Unspecified"}`,
    context?.topic || context?.taskTitle ? `Current learning target: ${context.topic ?? context.taskTitle}` : "",
    context?.selectedItem?.title ? `Current follow-up item: ${context.selectedItem.title}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLanguageAndReferenceBlock(input: AgentRequest) {
  const language = resolveInputLanguage(input);
  const profileId = resolveInputReferenceProfile(input);
  const practiceStyle = resolvePracticeStyle({
    language,
    practiceStyle: input.practiceStyle,
  });
  const profile = referenceProfiles[profileId];

  return `Language and reference profile:
- Detected language: ${languageName(language)}
- Response language: answer in ${languageName(language)} unless the user explicitly asks otherwise.
- Reference profile: ${profile.label}
- Practice style: ${describePracticeStyle(practiceStyle)}
- Profile instruction: ${profile.responseInstruction}
- Practice instruction: ${profile.practiceInstruction}
- Course reference notes: ${buildCourseReferenceInstruction(input.course ?? "general", profileId)}
- Copyright boundary: use only source style, terminology, sequencing, and training conventions. Do not reproduce protected text or official problem statements.`;
}

export function resolveInputLanguage(input: AgentRequest): DetectedLanguage {
  return input.detectedLanguage ?? input.memory?.recentLanguage ?? detectLanguage(input.message);
}

export function resolveInputReferenceProfile(input: AgentRequest): ReferenceProfileId {
  const language = resolveInputLanguage(input);
  return resolveReferenceProfile({
    language,
    practiceStyle: input.practiceStyle ?? input.memory?.practiceStyle,
    referenceProfile: input.referenceProfile ?? input.memory?.referenceProfile,
  });
}

function buildGeneralPrompt(
  input: AgentRequest,
  queryType: QueryType,
  intent: AgentIntent,
) {
  return `Intent: ${intentLabels[intent]}
Query type: ${queryTypeLabels[queryType]}

1. Answer strategy
- This is not a core physics task. Answer the user's question directly.
- Do not force physics concepts, physics equations, or problem-solving templates into the answer.
- For coding, give usable code, steps, or debugging advice.
- For writing, give structure, edits, or wording suggestions.
- For daily-life or general study questions, give clear practical advice.
- If the user mixes a general topic with physics experiments, modeling, or scientific data, answer the general question first and then add a small physics application note only if useful.
- Do not add the gentle physics-learning reminder yourself; it is appended after generation for general questions.

2. Language and context
${buildLanguageAndReferenceBlock(input)}

3. Current learning context
Use this only to understand continuity. If the current question is unrelated, do not force it into the learning context.
${buildLearningContextSnapshot(input)}

4. Recent conversation
${buildSessionMemory(input)}

5. Structured learning memory
${formatLearningMemory(input.memory)}

6. Internal role
${buildAgentRoleInstruction(intent, input.taskType)}

7. Local note context
${buildRagContext(input)}

8. Output constraints
- Avoid these stock phrases: ${forbiddenAnswerStyle.join(", ")}.
- The main answer must serve the user's actual question.
- If the user asks about this assistant's capabilities or usage, explain features, boundaries, and usage without adding the physics-learning reminder.
- Answer depth: ${buildAnswerDepthInstruction(input.answerDepth)}

9. User question
${input.message}`;
}

function buildPhysicsPrompt(
  input: AgentRequest,
  queryType: QueryType,
  intent: AgentIntent,
) {
  const taskType = (input.taskType ?? "qa") as TaskTypeId;
  const taskLabel = taskLabels[taskType];
  const difficultyLabel = labelById(difficultyOptions, input.difficulty);
  const course = input.course ?? "general";

  return `Intent: ${intentLabels[intent]}
Query type: ${queryTypeLabels[queryType]}

Treat this turn as an undergraduate physics or mathematical-physics learning task. Use the course template only because the current turn is physics-related; never apply it to unrelated general questions.

1. Task profile
- Course: ${getCourseLabel(course)}
- Task type: ${taskLabel}
- Difficulty: ${difficultyLabel}
- Practice count: ${input.exerciseCount ?? "Unspecified"}
- Include hint: ${input.includeHint ? "yes" : "no or unspecified"}
- Include answer: ${input.includeAnswer ? "yes" : "no or unspecified"}
- Include full solution: ${input.includeSolution ? "yes" : "no or unspecified"}

2. Language and reference profile
${buildLanguageAndReferenceBlock(input)}

3. Current learning context
${buildLearningContextSnapshot(input)}

4. Recent conversation
${buildSessionMemory(input)}

5. Structured learning memory
${formatLearningMemory(input.memory)}

6. Internal roles
${buildAgentRoleInstruction(intent, taskType)}

7. Course constraints
${buildCourseInstruction(course)}

8. Knowledge context
${buildKnowledgeContext(input)}

9. Local note context
${buildRagContext(input)}

10. Tool-page follow-up context
${buildToolContext(input)}

11. Output template
${buildTaskTemplate(taskType)}

12. Length guidance
${taskLengthHints[taskType]}

13. Style and correctness constraints
- Avoid these stock phrases: ${forbiddenAnswerStyle.join(", ")}.
- Answer the user's question first, then expand with derivation or explanation where needed.
- Use $...$ for inline formulas and $$...$$ for displayed formulas. Do not put formulas in code blocks unless the user asks for LaTeX source.
- For ambiguous questions, give the most common course interpretation first and briefly mention alternatives if needed.
- For false premises, correct them calmly.
- Internally classify the problem and assumptions before answering; do not show verbose internal reasoning.
- Results must match boundary conditions, initial conditions, gauge conditions, eigenvalue conditions, normalization conditions, ensemble assumptions, or process constraints as appropriate.
- The technical reviewer role must check symbol consistency, complete conditions, dimensions or limits, and whether the requested number and structure of practice problems are satisfied. Do not show the reviewer discussion.
- Answer depth: ${buildAnswerDepthInstruction(input.answerDepth)}
- Practice output mode: ${buildPracticeOutputInstruction(input.practiceOutputMode)}

14. User question
${input.message}`;
}

export function buildUserPrompt(input: AgentRequest) {
  const detectedLanguage = resolveInputLanguage(input);
  const normalizedInput: AgentRequest = {
    ...input,
    detectedLanguage,
    referenceProfile: input.referenceProfile ?? resolveInputReferenceProfile(input),
    practiceStyle:
      input.practiceStyle ??
      input.memory?.practiceStyle ??
      resolvePracticeStyle({ language: detectedLanguage }),
  };
  const queryType = normalizedInput.queryType ?? classifyQuery(normalizedInput);
  const intent = normalizedInput.intent ?? classifyAgentIntent(normalizedInput);

  if (isPhysicsIntent(intent)) {
    return buildPhysicsPrompt(normalizedInput, queryType, intent);
  }

  return buildGeneralPrompt(normalizedInput, queryType, intent);
}
