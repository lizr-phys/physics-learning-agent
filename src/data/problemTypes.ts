import type { CourseId } from "@/types/learning";

export type ProblemTypeExample = {
  course: CourseId;
  title: string;
  knowledgePoint?: string;
};

export const problemTypeExamples: ProblemTypeExample[] = [
  {
    course: "math-physics",
    title: "分离变量法求解弦振动方程",
    knowledgePoint: "separation-of-variables",
  },
  {
    course: "math-physics",
    title: "球坐标下 Laplace 方程边值问题",
    knowledgePoint: "special-functions",
  },
  {
    course: "electrodynamics",
    title: "镜像法求解导体边界问题",
    knowledgePoint: "image-method",
  },
  {
    course: "electrodynamics",
    title: "矩形波导 TE/TM 模本征频率",
    knowledgePoint: "waveguides-cavities",
  },
  {
    course: "quantum-mechanics",
    title: "一维定态 Schrödinger 方程束缚态问题",
    knowledgePoint: "one-dimensional-stationary",
  },
  {
    course: "quantum-mechanics",
    title: "非简并定态微扰的一阶能量修正",
    knowledgePoint: "perturbation-theory",
  },
  {
    course: "theoretical-mechanics",
    title: "Lagrange 方程建模问题",
    knowledgePoint: "lagrange-equations",
  },
  {
    course: "theoretical-mechanics",
    title: "小振动正常模求解",
    knowledgePoint: "small-oscillations",
  },
  {
    course: "thermo-stat",
    title: "正则系综计算热力学量",
    knowledgePoint: "canonical-ensemble",
  },
  {
    course: "thermo-stat",
    title: "由巨正则系综推导量子气体平均占据数",
    knowledgePoint: "grand-canonical-ensemble",
  },
];

export function getProblemTypeExamples(course?: CourseId) {
  if (!course) {
    return problemTypeExamples;
  }

  return problemTypeExamples.filter((example) => example.course === course);
}
