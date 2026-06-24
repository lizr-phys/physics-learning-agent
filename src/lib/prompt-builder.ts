import { buildCourseInstruction } from "@/data/courseInstructions";
import { getCourseLabel } from "@/data/courses";
import { buildAgentRoleInstruction } from "@/data/agentRoles";
import {
  buildSystemPrompt,
  forbiddenAnswerStyle,
  taskLengthHints,
  taskOutputTemplates,
} from "@/data/promptTemplates";
import { classifyAgentIntent, isPhysicsIntent } from "@/agent/intent-classifier";
import { formatLearningMemory } from "@/agent/memory-manager";
import { buildKnowledgeContext } from "@/lib/knowledge-utils";
import { classifyQuery } from "@/lib/query-classifier";
import {
  difficultyOptions,
  type AgentIntent,
  type AgentRequest,
  type QueryType,
  type TaskTypeId,
} from "@/types/learning";

export const PHYSICS_TUTOR_SYSTEM_PROMPT = buildSystemPrompt();

const taskLabels: Record<TaskTypeId, string> = {
  qa: "普通问答",
  explain: "知识点解释",
  derivation: "标准推导",
  "section-review": "板块复习",
  "problem-types": "题型梳理",
  practice: "练习题生成",
  "solution-guide": "解题指导",
  misconceptions: "易错点分析",
  "review-plan": "复习计划",
};

const queryTypeLabels: Record<QueryType, string> = {
  physics_core: "物理核心问题",
  math_physics_support: "数学物理支撑问题",
  coding: "编程/数据处理问题",
  daily_life: "生活或通用学习问题",
  writing: "写作/表达问题",
  other: "其他普通问题",
};

const intentLabels: Record<AgentIntent, string> = {
  physics_learning: "物理学习",
  exercise_generation: "练习题生成",
  study_planning: "学习规划与复习",
  general_question: "通用问题",
  meta_question: "助手使用问题",
};

const toolSourceLabels = {
  review: "板块复习",
  practice: "练习题生成",
  types: "题型梳理",
} as const;

function labelById<T extends readonly { id: string; label: string }[]>(items: T, id?: string) {
  return items.find((item) => item.id === id)?.label ?? "未指定";
}

export function buildTaskTemplate(taskType?: TaskTypeId) {
  return taskOutputTemplates[taskType ?? "qa"];
}

export function buildRagContext(input: AgentRequest) {
  const snippets = input.ragContext?.snippets ?? [];

  if (!snippets.length) {
    return input.useRag
      ? "用户启用了本地知识库，但没有检索到足够相关的本地资料。请正常回答；必要时说明“本地资料未覆盖该点”。"
      : "未启用本地知识库。";
  }

  return `以下是可参考的本地资料片段。优先依据这些片段和本地知识库，但不要大段复制资料，不要编造资料中不存在的页码；若资料不足，应说明“本地资料未覆盖该点”，再用通用物理知识补充。
${snippets
  .map(
    (snippet, index) =>
      `[${index + 1}] source: ${snippet.source}\ntitle: ${snippet.heading}\ncontent: ${snippet.content}`,
  )
  .join("\n\n")}

若使用了本地片段，回答末尾用简短“参考资料”列出文档名和片段标题。`;
}

function truncateContext(content: string, maxLength: number) {
  const normalized = content.replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}\n\n[以上内容已截断，后续回答应优先围绕已给出的具体片段。]`
    : normalized;
}

export function buildToolContext(input: AgentRequest) {
  const context = input.toolContext;

  if (!context) {
    return "没有来自工具页的上下文。";
  }

  const selected = context.selectedItem;
  const selectedBlock = selected?.content
    ? `用户当前追问对象：\n- 类型：${selected.type}\n- 标题：${selected.title ?? "未命名"}\n- 序号：${selected.index ?? "未指定"}\n\n${truncateContext(selected.content, 6000)}`
    : "";
  const generatedBlock = selectedBlock
    ? `完整生成内容摘要或截断版：\n${truncateContext(context.generatedContent, 3000)}`
    : `已生成内容：\n${truncateContext(context.generatedContent, 6000)}`;

  return `以下是用户刚才在工具页面生成的学习材料。当前回答如果与该材料相关，需要基于这份材料继续，不要当作全新对话。
来源：${toolSourceLabels[context.source]}
课程：${getCourseLabel(context.course)}
知识点：${context.knowledgeTitle ?? context.knowledgeId ?? "未指定"}
主题：${context.topic ?? context.taskTitle ?? "未指定"}
用户原始输入：${context.userInput ?? "未记录"}

${selectedBlock}

${generatedBlock}

回答时可以说明“沿用刚才的${toolSourceLabels[context.source]}内容”，但不要把整段材料原样重复给用户。`;
}

function buildSessionMemory(input: AgentRequest) {
  const history = input.history ?? [];

  if (!history.length) {
    return "暂无历史消息。";
  }

  return history
    .slice(-16)
    .map((message, index) => {
      const role = message.role === "user" ? "用户" : "Agent";
      return `${index + 1}. ${role}：${truncateContext(message.content, 700)}`;
    })
    .join("\n");
}

function buildLearningContextSnapshot(input: AgentRequest) {
  const context = input.toolContext;
  const moduleName = context ? toolSourceLabels[context.source] : "chat";

  return [
    `当前模块：${moduleName}`,
    `当前课程：${getCourseLabel(input.course)}`,
    `当前任务类型：${taskLabels[input.taskType ?? "qa"]}`,
    `当前知识点：${context?.knowledgeTitle ?? input.knowledgePoint ?? "未指定"}`,
    context?.topic || context?.taskTitle ? `当前学习主题：${context.topic ?? context.taskTitle}` : "",
    context?.selectedItem?.title ? `当前追问对象：${context.selectedItem.title}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildGeneralPrompt(
  input: AgentRequest,
  queryType: QueryType,
  intent: AgentIntent,
) {
  return `任务意图：${intentLabels[intent]}
问题分类：${queryTypeLabels[queryType]}

一、回答策略
- 这是非物理核心问题。请正常回答用户问题本身，不要拒答。
- 不要强行引入大学物理、数学物理方法、Maxwell 方程、Hamilton 体系、Green 函数、PDE 或变分法。
- 不要套用物理题型模板，不要自动改写成推导题或解题题。
- 如果问题是编程，直接给可用代码、步骤或排错建议。
- 如果问题是写作，直接给文本结构、改写稿或表达建议。
- 如果问题是生活、学习效率或其他普通问题，给清晰、实用的回答。
- 如果用户问题本身同时包含物理实验、科研数据、数值模拟等背景，可以先解决通用问题，再单独补充一小段物理应用。
- 不要主动添加“更适合物理学习”等身份提醒，系统会在输出完成后统一追加，避免重复。

二、当前学习上下文
这些信息只用于理解用户是否在延续某个学习目标；若本轮问题明显无关，不要强行套用。
${buildLearningContextSnapshot(input)}

三、最近会话上下文
${buildSessionMemory(input)}

四、结构化学习记忆
${formatLearningMemory(input.memory)}

五、内部角色
${buildAgentRoleInstruction(intent, input.taskType)}

六、输出限制
- 禁止出现这些套话：${forbiddenAnswerStyle.join("、")}。
- 主体回答必须围绕用户问题本身。
- 如果是关于本助手能力或使用方式的问题，只解释功能、边界和使用方法，不追加物理学习提醒。

七、用户问题
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

  return `任务意图：${intentLabels[intent]}
问题分类：${queryTypeLabels[queryType]}

请将本轮问题作为大学物理或数学物理学习任务处理。只有因为本轮问题被判定为物理/数学物理相关，才使用下列课程模板；不要把该模板用于非物理问题。

一、任务定位
- 课程：${getCourseLabel(course)}
- 任务类型：${taskLabel}
- 难度：${difficultyLabel}
- 练习数量：${input.exerciseCount ?? "未指定"}
- 是否需要提示：${input.includeHint ? "是" : "否或未指定"}
- 是否需要答案：${input.includeAnswer ? "是" : "否或未指定"}
- 是否需要详细解析：${input.includeSolution ? "是" : "否或未指定"}

二、当前学习上下文
${buildLearningContextSnapshot(input)}

三、最近会话上下文
${buildSessionMemory(input)}

四、结构化学习记忆
${formatLearningMemory(input.memory)}

五、内部角色分工
${buildAgentRoleInstruction(intent, taskType)}

六、课程约束
${buildCourseInstruction(course)}

七、知识点上下文
${buildKnowledgeContext(input)}

八、本地资料上下文
${buildRagContext(input)}

九、工具页连续追问上下文
${buildToolContext(input)}

十、输出模板
${buildTaskTemplate(taskType)}

十一、长度要求
${taskLengthHints[taskType]}

十二、回答风格限制
- 禁止出现这些套话：${forbiddenAnswerStyle.join("、")}。
- 先回答用户问题本身，再展开必要推导或解释。
- 公式统一使用行内 $...$ 或块级 $$...$$；不要把公式放进代码块，除非用户明确要求展示 LaTeX 源码。
- 对含糊问题，先给出最常见课程语境下的解释；必要时再说明其他理解。
- 对明显错误前提，要温和指出并修正。
- 回答前在内部判断问题类型和所需假设，不要展示冗长内部判断过程。
- 结论必须与边界条件、初始条件、规范条件、本征条件、归一化条件等限制一致。
- 输出前由严谨审稿角色检查：符号是否前后一致、条件是否完整、量纲或极限是否合理、练习题数量和结构是否满足要求。只修正最终答案，不展示角色讨论。

十三、用户问题
${input.message}`;
}

export function buildUserPrompt(input: AgentRequest) {
  const queryType = input.queryType ?? classifyQuery(input);
  const intent = input.intent ?? classifyAgentIntent(input);

  if (isPhysicsIntent(intent)) {
    return buildPhysicsPrompt(input, queryType, intent);
  }

  return buildGeneralPrompt(input, queryType, intent);
}
