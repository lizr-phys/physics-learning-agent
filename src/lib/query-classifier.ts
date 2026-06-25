import type { AgentRequest, QueryType, TaskTypeId } from "@/types/learning";

const physicsTaskTypes = new Set<TaskTypeId>([
  "explain",
  "derivation",
  "practice",
  "solution-guide",
  "misconceptions",
  "review-plan",
]);

const codingTerms = [
  "python",
  "matlab",
  "c++",
  "javascript",
  "typescript",
  "java",
  "代码",
  "编程",
  "程序",
  "脚本",
  "爬虫",
  "接口",
  "api",
  "debug",
  "bug",
  "报错",
  "npm",
  "next.js",
  "react",
  "数据处理",
  "画图",
  "绘图",
];

const writingTerms = [
  "简历",
  "邮件",
  "作文",
  "文案",
  "润色",
  "改写",
  "翻译",
  "申请信",
  "自我介绍",
  "汇报稿",
  "演讲稿",
  "项目总结",
];

const dailyLifeTerms = [
  "做饭",
  "菜谱",
  "天气",
  "旅行",
  "健身",
  "睡眠",
  "情绪",
  "恋爱",
  "租房",
  "理财",
  "效率",
  "时间管理",
  "学习建议",
  "计划安排",
  "买什么",
];

const physicsCoreTerms = [
  "普通物理",
  "大学物理",
  "中学物理",
  "物理实验",
  "误差分析",
  "不确定度",
  "运动学",
  "牛顿定律",
  "牛顿运动定律",
  "牛顿第一定律",
  "牛顿第二定律",
  "牛顿第三定律",
  "合外力",
  "加速度",
  "f=ma",
  "f = ma",
  "动量",
  "机械能",
  "振动",
  "波动",
  "几何光学",
  "物理教学",
  "力学",
  "理论力学",
  "拉格朗日",
  "lagrange",
  "哈密顿",
  "hamilton",
  "泊松括号",
  "刚体",
  "小振动",
  "电动力学",
  "maxwell",
  "麦克斯韦",
  "电磁",
  "静电",
  "静磁",
  "边值",
  "镜像法",
  "多极展开",
  "规范",
  "coulomb",
  "lorenz",
  "量子",
  "schrodinger",
  "薛定谔",
  "波函数",
  "态矢量",
  "算符",
  "本征值",
  "本征态",
  "角动量",
  "微扰",
  "谐振子",
  "势阱",
  "热力学",
  "统计物理",
  "系综",
  "配分函数",
  "boltzmann",
  "bose",
  "fermi",
  "相平衡",
];

const mathSupportTerms = [
  "数学物理",
  "复变",
  "解析函数",
  "cauchy",
  "riemann",
  "fourier",
  "傅里叶",
  "laplace",
  "拉普拉斯",
  "偏微分",
  "pde",
  "定解",
  "初值",
  "边界条件",
  "分离变量",
  "sturm",
  "liouville",
  "green 函数",
  "格林函数",
  "特殊函数",
  "legendre",
  "bessel",
  "变分法",
  "微积分",
  "线性代数",
  "矩阵",
  "本征",
  "正交",
  "完备",
];

const contextualFollowUpTerms = [
  "刚才",
  "上面",
  "这里",
  "这个",
  "这道题",
  "第一步",
  "第二步",
  "为什么这样",
  "继续",
  "展开讲",
  "这一步",
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
