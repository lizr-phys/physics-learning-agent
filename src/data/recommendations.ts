import type { CourseId, KnowledgeDifficulty } from "@/types/learning";

export type RecommendationType = "chat" | "practice";

export type RecommendationItem = {
  id: string;
  type: RecommendationType;
  course: Exclude<CourseId, "general">;
  knowledgeTitle?: string;
  title: string;
  prompt: string;
  tags: string[];
  difficulty?: KnowledgeDifficulty;
};

type Seed = {
  course: RecommendationItem["course"];
  tags: string[];
  chat: string[];
  practice: string[];
};

const seeds: Seed[] = [
  {
    course: "general-physics",
    tags: ["普通物理", "实验设计", "误差分析", "物理教学", "振动与波"],
    chat: [
      "解释为什么使用动量守恒前必须先选定系统",
      "Gauss 定律什么时候能直接用来求电场",
      "简谐振动近似需要满足什么条件",
      "如何区分热力学中的状态量和过程量",
      "怎样设计一个可检验的控制变量实验",
      "如何诊断学生对力和运动关系的常见误解",
    ],
    practice: [
      "生成 5 道 Newton 定律受力分析练习题",
      "生成 3 道动量与机械能综合题",
      "生成 5 道热力学过程练习题",
      "生成 3 道电磁感应练习题",
      "生成 5 道振动与波动练习题",
      "生成 3 道实验数据与不确定度分析题",
    ],
  },
  {
    course: "math-physics",
    tags: ["Green 函数", "分离变量法", "边值问题", "Fourier", "Sturm-Liouville"],
    chat: [
      "解释 Green 函数与边界条件的关系",
      "为什么分离变量法会把定解问题转化为本征值问题",
      "Fourier 级数展开中的正交性到底起什么作用",
      "Laplace 变换适合处理哪类初值问题",
      "Sturm-Liouville 问题中的权函数有什么意义",
      "复变函数解析性和 Cauchy-Riemann 方程怎样联系",
    ],
    practice: [
      "生成 5 道 Fourier 级数展开练习题",
      "生成 3 道复变函数解析性判断题",
      "生成 5 道 Green 函数定解问题练习题",
      "生成 5 道 Laplace 变换求解初值问题练习题",
      "生成 3 道 Sturm-Liouville 本征值问题练习题",
      "生成 5 道分离变量法求解热传导方程练习题",
    ],
  },
  {
    course: "theoretical-mechanics",
    tags: ["Lagrange 方程", "Hamilton", "约束", "小振动", "刚体"],
    chat: [
      "Lagrange 方程为什么可以不显式写约束力",
      "广义坐标和普通坐标有什么区别",
      "虚功原理中的虚位移为什么不是实际位移",
      "Hamilton 正则方程和 Lagrange 方程如何等价",
      "Poisson 括号为什么能描述守恒量",
      "小振动问题中正则坐标有什么作用",
    ],
    practice: [
      "生成 5 道广义坐标建模练习题",
      "生成 3 道刚体定轴转动练习题",
      "生成 5 道 Lagrange 方程建模题",
      "生成 3 道小振动正则模练习题",
      "生成 5 道 Hamilton 正则方程练习题",
      "生成 3 道非惯性系动力学练习题",
    ],
  },
  {
    course: "electrodynamics",
    tags: ["Maxwell 方程组", "边值问题", "镜像法", "电磁波", "规范"],
    chat: [
      "解释静电边值问题中唯一性定理的作用",
      "为什么介质中要区分 E 和 D",
      "Coulomb 规范和 Lorenz 规范的区别是什么",
      "电磁势为什么不是唯一的",
      "Maxwell 方程组如何推出电磁波方程",
      "多极展开中的远场近似怎样理解",
    ],
    practice: [
      "生成 5 道 Maxwell 方程组应用练习题",
      "生成 3 道平面电磁波边界条件练习题",
      "生成 5 道静电边值问题练习题",
      "生成 3 道镜像法求解导体边界问题",
      "生成 5 道电磁势与规范变换练习题",
      "生成 3 道多极展开远场近似练习题",
    ],
  },
  {
    course: "quantum-mechanics",
    tags: ["一维定态", "谐振子", "角动量", "微扰", "自旋"],
    chat: [
      "解释一维定态问题中边界条件如何决定能级",
      "一维谐振子的本征值为什么是离散的",
      "表象变换在量子力学中表示什么",
      "角动量算符的对易关系怎样理解",
      "非简并定态微扰论的适用条件是什么",
      "全同粒子的交换对称性为什么重要",
    ],
    practice: [
      "生成 5 道谐振子升降算符练习题",
      "生成 3 道自旋测量练习题",
      "生成 5 道一维定态问题练习题",
      "生成 3 道角动量算符对易关系练习题",
      "生成 5 道定态微扰论练习题",
      "生成 3 道全同粒子态构造练习题",
    ],
  },
  {
    course: "thermo-stat",
    tags: ["正则系综", "热力学势", "Maxwell 关系", "量子统计", "涨落"],
    chat: [
      "解释正则系综和微正则系综的区别",
      "热力学势的自然变量为什么重要",
      "Boltzmann 分布和 Gibbs 分布有什么关系",
      "Bose-Einstein 分布和 Fermi-Dirac 分布适用条件是什么",
      "Maxwell 关系如何从热力学势推出",
      "配分函数为什么能导出热力学量",
    ],
    practice: [
      "生成 5 道热力学势自然变量练习题",
      "生成 3 道配分函数计算练习题",
      "生成 5 道正则系综练习题",
      "生成 3 道 Maxwell 关系应用题",
      "生成 5 道 Bose-Einstein 和 Fermi-Dirac 分布练习题",
      "生成 3 道相平衡条件练习题",
    ],
  },
];

export const recommendationItems: RecommendationItem[] = seeds.flatMap((seed) =>
  (["chat", "practice"] as const).flatMap((type) =>
    seed[type].map((title, index) => ({
      id: `${seed.course}-${type}-${index + 1}`,
      type,
      course: seed.course,
      knowledgeTitle: title.replace(/^(解释|生成 \d+ 道)\s*/, ""),
      title,
      prompt: title,
      tags: seed.tags,
      difficulty: index < 2 ? "basic" : index < 4 ? "intermediate" : "advanced",
    })),
  ),
);
