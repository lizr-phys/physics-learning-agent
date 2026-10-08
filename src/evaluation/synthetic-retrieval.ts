import { tokenize } from "@/rag/chunk";
import type { RetrievalEvaluationCase } from "@/rag/evaluation";
import type { RagChunk } from "@/rag/types";
import type { CourseId, DetectedLanguage } from "@/types/learning";

// A controlled software fixture, not a representative student corpus or human-reviewed physics benchmark.
export const syntheticRetrievalProvenance = {
  kind: "synthetic", humanReviewed: false,
  description: "Author-created bilingual toy passages; expected IDs come from fixture ownership. No real model or student data.",
} as const;

type Topic = { course: Exclude<CourseId, "general">; id: string; zh: string; en: string; zhText: string; enText: string };
const topics: Topic[] = [
  { course: "general-physics", id: "newton", zh: "牛顿第二定律", en: "Newton's second law", zhText: "牛顿第二定律在惯性参考系中写为 $\\mathbf F=m\\mathbf a$。这里假定质量不变，合力决定加速度。", enText: "Newton's second law in an inertial frame is $\\mathbf F=m\\mathbf a$. Assume constant mass; net force determines acceleration." },
  { course: "general-physics", id: "oscillator", zh: "简谐振动", en: "harmonic oscillator", zhText: "简谐振动采用线性回复力 $F=-kx$。在 $m>0,k>0$ 时，周期为 $T=2\\pi\\sqrt{m/k}$。", enText: "The harmonic oscillator has a linear restoring force $F=-kx$. For positive mass and stiffness the period is $T=2\\pi\\sqrt{m/k}$." },
  { course: "general-physics", id: "kirchhoff", zh: "基尔霍夫定律", en: "Kirchhoff laws", zhText: "基尔霍夫定律在集中参数电路近似中表示节点电流守恒和闭合回路电压关系。使用回路规则时必须处理外加感应电动势。", enText: "Kirchhoff laws express node current conservation and loop voltage relations in a lumped circuit approximation. Applied induction must be included in the loop equation." },
  { course: "general-physics", id: "lens", zh: "薄透镜", en: "thin lens", zhText: "薄透镜在近轴近似下满足 $1/f=1/s+1/s'$。使用公式前应声明物距、像距及焦距的符号约定。", enText: "A thin lens in the paraxial approximation satisfies $1/f=1/s+1/s'$. State the object, image and focal-distance sign convention before applying the equation." },
  { course: "math-physics", id: "green", zh: "格林函数", en: "Green function", zhText: "格林函数由线性微分算符、定义域和边界条件共同决定。齐次边界条件约束算符的允许响应。", enText: "A Green function is specified by a linear differential operator, its domain and boundary conditions. Homogeneous boundary conditions constrain the admissible response." },
  { course: "math-physics", id: "fourier", zh: "傅里叶变换", en: "Fourier transform", zhText: "傅里叶变换将空间或时间函数映射为频率表示。变换与逆变换必须采用配套的指数符号和归一化约定。", enText: "A Fourier transform maps a function to a frequency representation. Forward and inverse transforms must use compatible exponent signs and normalization conventions." },
  { course: "math-physics", id: "sturm", zh: "斯图姆 刘维尔", en: "Sturm Liouville", zhText: "斯图姆 刘维尔问题在自伴边界条件下具有关于权函数的本征函数正交关系。必须明确区间、权函数及端点条件。", enText: "A Sturm Liouville problem with self-adjoint boundary conditions has eigenfunction orthogonality under its weight. Specify the interval, weight and endpoint conditions." },
  { course: "math-physics", id: "bessel", zh: "贝塞尔函数", en: "Bessel function", zhText: "贝塞尔函数出现在圆柱坐标的分离变量问题中。是否排除第二类解取决于区域是否包含原点及所要求的正则性。", enText: "A Bessel function occurs in cylindrical separation of variables. Excluding the second-kind solution depends on whether the domain includes the origin and on regularity requirements." },
  { course: "theoretical-mechanics", id: "hamilton", zh: "哈密顿正则方程", en: "Hamilton equations", zhText: "哈密顿正则方程为 $\\dot q_i=\\partial H/\\partial p_i$ 和 $\\dot p_i=-\\partial H/\\partial q_i$。正则坐标和动量构成相空间变量。", enText: "Hamilton equations are $\\dot q_i=\\partial H/\\partial p_i$ and $\\dot p_i=-\\partial H/\\partial q_i$. Canonical coordinates and momenta are phase-space variables." },
  { course: "theoretical-mechanics", id: "lagrange", zh: "拉格朗日方程", en: "Lagrange equations", zhText: "拉格朗日方程在适用的广义坐标下给出运动方程。理想完整约束可通过坐标消去，非保守广义力须明确加入。", enText: "Lagrange equations give motion in suitable generalized coordinates. Ideal holonomic constraints may be eliminated with coordinates; nonconservative generalized forces must be included explicitly." },
  { course: "theoretical-mechanics", id: "poisson", zh: "泊松括号", en: "Poisson bracket", zhText: "泊松括号描述正则相空间函数的代数结构。计算时需对同一组正则坐标和正则动量取偏导。", enText: "A Poisson bracket describes the algebra of phase-space functions. Derivatives must refer to one consistent set of canonical coordinates and momenta." },
  { course: "theoretical-mechanics", id: "central", zh: "中心力", en: "central force", zhText: "中心力沿径向作用，关于力心的力矩为零。角动量守恒使非零角动量的轨道运动限制在一个平面内。", enText: "A central force acts radially and has zero torque about the force center. Angular momentum conservation confines a nonzero-angular-momentum orbit to a plane." },
  { course: "electrodynamics", id: "maxwell", zh: "麦克斯韦方程", en: "Maxwell equations", zhText: "麦克斯韦方程联系电磁场与电荷和电流。物质介质中还需指定本构关系、单位制和界面条件。", enText: "Maxwell equations connect electromagnetic fields to charge and current. In material media, specify constitutive relations, units and interface conditions." },
  { course: "electrodynamics", id: "images", zh: "镜像法", en: "image method", zhText: "镜像法构造满足指定边界的辅助电荷解。唯一性定理说明它在原问题求解区域内可以替代真实边界。", enText: "The image method constructs auxiliary charges satisfying a specified boundary. A uniqueness theorem establishes equivalence inside the original solution domain." },
  { course: "electrodynamics", id: "gauge", zh: "规范变换", en: "gauge transformation", zhText: "规范变换同时改变标势和矢势而保持电磁场不变。所选规范仍须与边界条件和初始条件相容。", enText: "A gauge transformation changes scalar and vector potentials together while preserving fields. A chosen gauge must remain compatible with boundary and initial conditions." },
  { course: "electrodynamics", id: "multipole", zh: "多极展开", en: "multipole expansion", zhText: "多极展开按电荷分布矩组织远区势。采用外部展开时，观察距离应大于包含源分布的特征尺度。", enText: "A multipole expansion organizes a distant potential by source moments. For an exterior expansion, the observation radius must exceed the scale enclosing the source." },
  { course: "quantum-mechanics", id: "uncertainty", zh: "不确定性原理", en: "uncertainty principle", zhText: "不确定性原理约束同一量子态中可观测量的标准差。它不是对一次测量误差的通用定义。", enText: "The uncertainty principle constrains observable standard deviations within a quantum state. It is not a general definition of single-measurement error." },
  { course: "quantum-mechanics", id: "spin", zh: "量子自旋", en: "quantum spin", zhText: "量子自旋是内禀角动量。自旋二分之一体系用两个基态表示，需要声明量子化轴和态的归一化。", enText: "Quantum spin is intrinsic angular momentum. A spin-half system uses two basis states; specify the quantization axis and state normalization." },
  { course: "quantum-mechanics", id: "tunneling", zh: "量子隧穿", en: "quantum tunneling", zhText: "量子隧穿允许波函数穿过经典禁阻势垒。透射问题须给出势、入射方向及两侧允许的渐近解。", enText: "Quantum tunneling allows a wave function through a classically forbidden barrier. A transmission problem specifies the potential, incidence direction and allowed asymptotic solutions." },
  { course: "quantum-mechanics", id: "perturbation", zh: "微扰理论", en: "perturbation theory", zhText: "微扰理论围绕可解的未扰动体系展开。非简并公式不能直接用于简并能级；需先在简并子空间处理扰动。", enText: "Perturbation theory expands around a solvable unperturbed system. Nondegenerate formulas cannot be applied directly to degenerate levels; first handle the perturbation within that subspace." },
  { course: "thermo-stat", id: "canonical", zh: "正则系综", en: "canonical ensemble", zhText: "正则系综描述与热库交换能量而粒子数和体积固定的体系。概率权重由温度和体系能量决定。", enText: "The canonical ensemble describes energy exchange with a heat bath at fixed particle number and volume. Temperature and state energy determine the probability weights." },
  { course: "thermo-stat", id: "partition", zh: "配分函数", en: "partition function", zhText: "配分函数汇总指定系综中允许微观态的统计权重。对温度或外参数求导时，必须注明保持不变的变量。", enText: "A partition function sums weights over permitted microstates in a specified ensemble. State which variables are fixed when differentiating temperature or external parameters." },
  { course: "thermo-stat", id: "chemical", zh: "化学势", en: "chemical potential", zhText: "化学势是适当热力学势对粒子数的偏导。定义时必须说明熵和体积或温度和压强等保持不变的变量。", enText: "Chemical potential is a particle-number derivative of an appropriate thermodynamic potential. Specify the fixed entropy and volume, or temperature and pressure, as appropriate." },
  { course: "thermo-stat", id: "bose", zh: "玻色分布", en: "Bose Einstein distribution", zhText: "玻色分布描述非相互作用或合适近似中的玻色子占据数。其形式依赖温度、能量和化学势，不能套用于费米子。", enText: "The Bose Einstein distribution describes boson occupations for noninteracting particles or an appropriate approximation. It depends on temperature, energy and chemical potential and does not apply to fermions." },
];

function sourceId(topic: Topic, language: DetectedLanguage) { return `synthetic:${topic.course}:${topic.id}:${language}`; }

export const syntheticRetrievalChunks: RagChunk[] = topics.flatMap((topic) => (["zh", "en"] as const).map((language) => {
  const content = language === "zh" ? topic.zhText : topic.enText;
  return { id: sourceId(topic, language), source: `${topic.course}/${topic.id}-${language}.md`,
    heading: language === "zh" ? topic.zh : topic.en, content, tokens: tokenize(content),
    metadata: { course: topic.course, topic: topic.id, language, tokenVersion: 3 } };
}));

export type SyntheticRetrievalCase = RetrievalEvaluationCase & {
  course: Exclude<CourseId, "general">;
  kind: "direct" | "cross-language" | "no-answer";
  queryLanguage: DetectedLanguage;
};

const positiveCases: SyntheticRetrievalCase[] = topics.flatMap((topic) => [
  { id: `${topic.course}-${topic.id}-zh`, query: `请说明${topic.zh}及其适用条件`, course: topic.course, sourceLanguage: "zh", queryLanguage: "zh", kind: "direct", relevantChunkIds: [sourceId(topic, "zh")] },
  { id: `${topic.course}-${topic.id}-en`, query: `Explain ${topic.en} and its assumptions.`, course: topic.course, sourceLanguage: "en", queryLanguage: "en", kind: "direct", relevantChunkIds: [sourceId(topic, "en")] },
  { id: `${topic.course}-${topic.id}-zh-to-en`, query: `${topic.zh}的含义与必要约定是什么`, course: topic.course, sourceLanguage: "en", queryLanguage: "zh", kind: "cross-language", relevantChunkIds: [sourceId(topic, "en")] },
  { id: `${topic.course}-${topic.id}-en-to-zh`, query: `What defines ${topic.en}?`, course: topic.course, sourceLanguage: "zh", queryLanguage: "en", kind: "cross-language", relevantChunkIds: [sourceId(topic, "zh")] },
] as SyntheticRetrievalCase[]);
const courses = Array.from(new Set(topics.map((topic) => topic.course)));
const negativeQueries = ["黑洞霍金辐射", "neutrino mixing", "厨房番茄炒蛋", "galactic redshift cosmology"];
export const syntheticRetrievalCases: SyntheticRetrievalCase[] = [...positiveCases,
  ...courses.flatMap((course) => negativeQueries.map((query, index) => ({
    id: `${course}-no-answer-${index}`, query, course, queryLanguage: index % 2 ? "en" as const : "zh" as const,
    kind: "no-answer" as const, relevantChunkIds: [],
  }))),
];
