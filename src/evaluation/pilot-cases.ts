import type { AgentIntent, AgentRequest, CourseId } from "@/types/learning";

export type IntentEvaluationCase = {
  id: string;
  request: AgentRequest;
  expected: AgentIntent;
};

export type CourseEvaluationCase = {
  id: string;
  query: string;
  expected: Exclude<CourseId, "general">;
};

export type RetrievalEvaluationCase = {
  id: string;
  query: string;
  expectedSource: "math-physics.md" | "electrodynamics.md";
};

export const intentEvaluationCases: IntentEvaluationCase[] = [
  {
    id: "zh-hamilton-review",
    request: { message: "我想复习哈密顿力学" },
    expected: "study_planning",
  },
  {
    id: "zh-green-concept",
    request: { message: "解释 Green 函数和边界条件的关系" },
    expected: "physics_learning",
  },
  {
    id: "zh-quantum-practice",
    request: { message: "生成 5 道量子力学一维定态问题练习题" },
    expected: "exercise_generation",
  },
  {
    id: "zh-electrodynamics-plan",
    request: { message: "给我一个电动力学两周学习计划" },
    expected: "study_planning",
  },
  {
    id: "zh-general-physics",
    request: { message: "为什么简谐振子的周期与振幅无关" },
    expected: "physics_learning",
  },
  {
    id: "en-quantum-concept",
    request: { message: "Why are harmonic-oscillator energy levels discrete?" },
    expected: "physics_learning",
  },
  {
    id: "en-open-course-practice",
    request: {
      message: "Generate 3 open-course problems on electrostatic boundary conditions.",
    },
    expected: "exercise_generation",
  },
  {
    id: "en-thermo-plan",
    request: { message: "Build a study plan for the canonical ensemble." },
    expected: "study_planning",
  },
  {
    id: "contextual-harder",
    request: {
      message: "Make the next one harder.",
      course: "quantum-mechanics",
      knowledgePoint: "Harmonic oscillator",
    },
    expected: "exercise_generation",
  },
  {
    id: "contextual-why",
    request: {
      message: "Why does this step follow?",
      course: "math-physics",
      knowledgePoint: "Green functions",
    },
    expected: "physics_learning",
  },
  {
    id: "python",
    request: { message: "帮我写一个 Python 爬虫并解释异常处理" },
    expected: "general_question",
  },
  {
    id: "resume",
    request: { message: "帮我修改一份产品经理简历" },
    expected: "general_question",
  },
  {
    id: "cooking",
    request: { message: "如何做一份番茄炒蛋" },
    expected: "general_question",
  },
  {
    id: "weather-in-physics-context",
    request: {
      message: "明天的天气怎么样",
      course: "math-physics",
      knowledgePoint: "Complex variables",
    },
    expected: "general_question",
  },
  {
    id: "english-study-plan",
    request: { message: "帮我做一个英语学习计划" },
    expected: "general_question",
  },
  {
    id: "grammar-exercises",
    request: { message: "帮我生成英语语法练习题" },
    expected: "general_question",
  },
  {
    id: "meta-capabilities",
    request: { message: "What can this assistant do?" },
    expected: "meta_question",
  },
  {
    id: "meta-knowledge-base",
    request: { message: "How do I use the personal knowledge base?" },
    expected: "meta_question",
  },
];

export const courseEvaluationCases: CourseEvaluationCase[] = [
  {
    id: "zh-general-physics",
    query: "大学物理中的简谐振动",
    expected: "general-physics",
  },
  {
    id: "en-general-physics",
    query: "introductory physics momentum conservation",
    expected: "general-physics",
  },
  {
    id: "zh-math-physics",
    query: "数学物理方法中的分离变量法",
    expected: "math-physics",
  },
  {
    id: "en-math-physics",
    query: "mathematical methods for physics and Green functions",
    expected: "math-physics",
  },
  {
    id: "zh-theoretical-mechanics",
    query: "我想复习哈密顿力学",
    expected: "theoretical-mechanics",
  },
  {
    id: "en-theoretical-mechanics",
    query: "classical mechanics with canonical transformations",
    expected: "theoretical-mechanics",
  },
  {
    id: "zh-electrodynamics",
    query: "电动力学中的静电边值问题",
    expected: "electrodynamics",
  },
  {
    id: "en-electrodynamics",
    query: "electrodynamics and electromagnetic gauge transformations",
    expected: "electrodynamics",
  },
  {
    id: "zh-quantum",
    query: "量子力学的一维定态问题",
    expected: "quantum-mechanics",
  },
  {
    id: "en-quantum",
    query: "quantum mechanics harmonic oscillator",
    expected: "quantum-mechanics",
  },
  {
    id: "zh-thermo-stat",
    query: "热力学与统计物理中的正则系综",
    expected: "thermo-stat",
  },
  {
    id: "en-thermo-stat",
    query: "statistical mechanics canonical ensemble",
    expected: "thermo-stat",
  },
];

export const retrievalEvaluationCases: RetrievalEvaluationCase[] = [
  {
    id: "green-boundary",
    query: "Green 函数为什么必须满足边界条件",
    expectedSource: "math-physics.md",
  },
  {
    id: "separation-variables",
    query: "分离变量法如何由边界条件确定本征值",
    expectedSource: "math-physics.md",
  },
  {
    id: "sturm-liouville",
    query: "Sturm Liouville 权函数 正交性",
    expectedSource: "math-physics.md",
  },
  {
    id: "electrostatic-boundary",
    query: "静电边值问题的区域与边界条件",
    expectedSource: "electrodynamics.md",
  },
  {
    id: "image-method",
    query: "镜像法为什么依赖唯一性定理",
    expectedSource: "electrodynamics.md",
  },
  {
    id: "gauge-potentials",
    query: "Lorenz 规范 Coulomb 规范 电磁势",
    expectedSource: "electrodynamics.md",
  },
];
