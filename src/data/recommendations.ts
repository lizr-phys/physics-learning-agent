import type { CourseId, KnowledgeDifficulty } from "@/types/learning";

export type RecommendationType = "chat" | "practice" | "problemType" | "review";

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
  knowledgeTitle?: string;
  tags: string[];
  chat: string[];
  practice: string[];
  problemType: string[];
  review: string[];
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
    problemType: [
      "梳理连接体与约束动力学题型",
      "梳理碰撞中的守恒定律选择",
      "梳理理想气体过程图像题",
      "梳理电磁感应方向与大小判断",
      "梳理驻波边界条件题型",
      "梳理控制变量实验设计题型",
    ],
    review: [
      "复习普通物理力学建模",
      "复习动量、角动量与机械能",
      "复习热学基础与热力学过程",
      "复习电磁学积分定律",
      "复习振动、波动与光学基础",
      "复习物理实验设计与误差分析",
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
    problemType: [
      "梳理球坐标下 Laplace 方程边值问题",
      "梳理分离变量法求解弦振动方程",
      "梳理 Green 函数求解 Poisson 方程题型",
      "梳理 Fourier 变换处理无界区域定解问题",
      "梳理 Sturm-Liouville 展开系数确定题型",
      "梳理留数定理计算实积分题型",
    ],
    review: [
      "复习 Green 函数方法",
      "复习数学物理方程定解问题",
      "复习 Fourier 级数与 Fourier 变换",
      "复习 Sturm-Liouville 本征值问题",
      "复习复变函数与留数定理",
      "复习分离变量法的标准流程",
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
    problemType: [
      "梳理 Lagrange 方程建模题",
      "梳理虚功原理相关题型",
      "梳理小振动问题的标准解法",
      "梳理 Hamilton 函数构造题型",
      "梳理刚体定点运动题型",
      "梳理含约束质点系动力学题型",
    ],
    review: [
      "复习 Lagrange 方程",
      "复习 Hamilton 正则方程",
      "复习虚功原理与约束",
      "复习小振动理论",
      "复习刚体动力学",
      "复习非惯性系中的动力学方程",
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
    problemType: [
      "梳理镜像法的常见题型",
      "梳理静电边值问题的分离变量法",
      "梳理球对称电荷分布的多极展开题型",
      "梳理平面电磁波在介质界面的边界条件",
      "梳理电磁势与规范变换题型",
      "梳理波导中电磁场模式题型",
    ],
    review: [
      "复习 Maxwell 方程组",
      "复习静电边值问题",
      "复习电磁势与规范变换",
      "复习电磁波传播",
      "复习多极展开",
      "复习电磁辐射基础",
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
    problemType: [
      "梳理一维无限深势阱题型",
      "梳理一维定态 Schrödinger 方程束缚态问题",
      "梳理定态微扰论常见题型",
      "梳理角动量耦合题型",
      "梳理谐振子升降算符题型",
      "梳理自旋测量与表象变换题型",
    ],
    review: [
      "复习一维定态问题",
      "复习角动量算符对易关系",
      "复习定态微扰论",
      "复习一维谐振子",
      "复习表象理论",
      "复习全同粒子与交换对称性",
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
    problemType: [
      "梳理 Maxwell 关系的应用题型",
      "梳理正则系综计算热力学量",
      "梳理相平衡条件推导题型",
      "梳理配分函数求内能和热容题型",
      "梳理量子统计分布函数题型",
      "梳理涨落公式应用题型",
    ],
    review: [
      "复习正则系综",
      "复习 Bose-Einstein 分布和 Fermi-Dirac 分布",
      "复习热力学势与 Maxwell 关系",
      "复习相平衡条件",
      "复习配分函数方法",
      "复习涨落理论基础",
    ],
  },
];

const typeToListKey = {
  chat: "chat",
  practice: "practice",
  problemType: "problemType",
  review: "review",
} as const;

export const recommendationItems: RecommendationItem[] = seeds.flatMap((seed) =>
  (Object.keys(typeToListKey) as RecommendationType[]).flatMap((type) =>
    seed[typeToListKey[type]].map((title, index) => ({
      id: `${seed.course}-${type}-${index + 1}`,
      type,
      course: seed.course,
      knowledgeTitle: title.replace(/^(解释|梳理|生成 \d+ 道|复习)\s*/, ""),
      title,
      prompt: title,
      tags: seed.tags,
      difficulty: index < 2 ? "basic" : index < 4 ? "intermediate" : "advanced",
    })),
  ),
);
