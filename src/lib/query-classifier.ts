import type { AgentRequest, QueryType, TaskTypeId } from "@/types/learning";

const physicsTaskTypes = new Set<TaskTypeId>([
  "explain",
  "derivation",
  "practice",
  "solution-guide",
  "misconceptions",
  "study-plan",
]);

const codingTerms = [
  "python",
  "matlab",
  "c++",
  "javascript",
  "typescript",
  "java",
  "code",
  "script",
  "crawler",
  "api",
  "debug",
  "bug",
  "error",
  "npm",
  "next.js",
  "react",
  "data processing",
  "plot",
  "代码",
  "编程",
  "程序",
  "脚本",
  "爬虫",
  "报错",
  "数据处理",
  "画图",
  "绘图",
];

const writingTerms = [
  "resume",
  "email",
  "essay",
  "copywriting",
  "polish",
  "rewrite",
  "translate",
  "cover letter",
  "presentation script",
  "简历",
  "邮件",
  "作文",
  "文案",
  "润色",
  "改写",
  "翻译",
  "申请信",
];

const dailyLifeTerms = [
  "cook",
  "recipe",
  "weather",
  "travel",
  "fitness",
  "sleep",
  "relationship",
  "rent",
  "budget",
  "productivity",
  "time management",
  "study advice",
  "做饭",
  "菜谱",
  "天气",
  "旅行",
  "健身",
  "睡眠",
  "效率",
  "时间管理",
  "学习建议",
];

const physicsCoreTerms = [
  "physics",
  "mechanics",
  "classical mechanics",
  "newton",
  "lagrange",
  "lagrangian",
  "hamilton",
  "hamiltonian",
  "poisson bracket",
  "rigid body",
  "oscillation",
  "maxwell",
  "electrodynamics",
  "electromagnetism",
  "electrostatic",
  "magnetostatic",
  "boundary condition",
  "boundary-value",
  "image method",
  "multipole",
  "gauge",
  "coulomb",
  "lorenz",
  "quantum",
  "schrodinger",
  "wave function",
  "state vector",
  "operator",
  "eigenvalue",
  "eigenstate",
  "angular momentum",
  "perturbation",
  "harmonic oscillator",
  "potential well",
  "thermodynamics",
  "statistical mechanics",
  "ensemble",
  "partition function",
  "boltzmann",
  "bose",
  "fermi",
  "phase equilibrium",
  "普通物理",
  "大学物理",
  "中学物理",
  "物理实验",
  "牛顿",
  "理论力学",
  "电动力学",
  "量子",
  "热力学",
  "统计物理",
  "系综",
  "配分函数",
  "谐振子",
  "角动量",
  "微扰",
  "边界条件",
  "边值",
  "镜像法",
  "规范",
];

const mathSupportTerms = [
  "mathematical physics",
  "mathematical methods",
  "complex variables",
  "analytic function",
  "cauchy",
  "riemann",
  "fourier",
  "laplace",
  "partial differential",
  "pde",
  "initial value",
  "sturm",
  "liouville",
  "green's function",
  "green function",
  "legendre",
  "bessel",
  "variational",
  "calculus",
  "linear algebra",
  "matrix",
  "orthogonal",
  "complete set",
  "数学物理",
  "复变",
  "解析函数",
  "傅里叶",
  "拉普拉斯",
  "偏微分",
  "定解",
  "初值",
  "分离变量",
  "格林函数",
  "特殊函数",
  "变分法",
  "线性代数",
];

const contextualFollowUpTerms = [
  "above",
  "previous",
  "this step",
  "this problem",
  "why",
  "continue",
  "make it harder",
  "another one",
  "next one",
  "刚才",
  "上面",
  "这里",
  "这个",
  "这道题",
  "第一步",
  "第二步",
  "为什么这样",
  "继续",
  "再来",
];

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function hasLearningContext(input: AgentRequest) {
  return Boolean(
    input.toolContext ||
      input.knowledgePoint ||
      (input.course && input.course !== "general") ||
      input.ragContext?.snippets?.length,
  );
}

export function classifyQuery(input: AgentRequest): QueryType {
  const text = input.message.toLowerCase();

  // Strong non-physics intents must win over stale course or knowledge context.
  if (includesAny(text, codingTerms)) {
    return "coding";
  }

  if (includesAny(text, writingTerms)) {
    return "writing";
  }

  if (includesAny(text, dailyLifeTerms)) {
    return "daily_life";
  }

  if (includesAny(text, physicsCoreTerms)) {
    return "physics_core";
  }

  if (includesAny(text, mathSupportTerms)) {
    return "math_physics_support";
  }

  if (hasLearningContext(input) && includesAny(text, contextualFollowUpTerms)) {
    return "physics_core";
  }

  if (input.taskType && physicsTaskTypes.has(input.taskType)) {
    return "physics_core";
  }

  return "other";
}

export function isPhysicsLikeQuery(queryType: QueryType) {
  return queryType === "physics_core" || queryType === "math_physics_support";
}
