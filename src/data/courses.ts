import type { CourseId } from "@/types/learning";

export type CourseOption = {
  id: Exclude<CourseId, "general">;
  label: string;
  shortLabel: string;
  textbookReferences: string[];
  contextSummary: string;
};

export const courseOptions: CourseOption[] = [
  {
    id: "general-physics",
    label: "普通物理与物理教学",
    shortLabel: "普通物理",
    textbookReferences: ["国内高校普通物理课程体系", "中学物理课程标准与教学案例"],
    contextSummary:
      "课程覆盖力学、热学、电磁学、振动与波、光学和近代物理基础，并关注物理概念形成、实验设计、误差分析和中学物理教学表达。",
  },
  {
    id: "math-physics",
    label: "数学物理方法",
    shortLabel: "数理方法",
    textbookReferences: ["梁昆淼《数学物理方法》", "郭硕鸿体系数学物理方法讲义"],
    contextSummary:
      "课程以复变函数、积分变换、数学物理方程和特殊函数为主线，强调定解问题、初始条件、边界条件、本征值问题、正交完备性和 Green 函数方法。",
  },
  {
    id: "theoretical-mechanics",
    label: "理论力学",
    shortLabel: "理论力学",
    textbookReferences: ["周衍柏《理论力学教程》"],
    contextSummary:
      "课程从 Newton 力学过渡到 Lagrange 表述和 Hamilton 表述，重点处理约束、广义坐标、广义力、虚位移、正则变量和小振动。",
  },
  {
    id: "electrodynamics",
    label: "电动力学",
    shortLabel: "电动力学",
    textbookReferences: ["郭硕鸿《电动力学》"],
    contextSummary:
      "课程围绕 Maxwell 方程组展开，区分静态场与时变场、真空与介质、电势与矢势、自由电荷与束缚电荷，并训练边值问题、电磁波和辐射问题。",
  },
  {
    id: "quantum-mechanics",
    label: "量子力学",
    shortLabel: "量子力学",
    textbookReferences: ["曾谨言《量子力学》", "周世勋《量子力学教程》"],
    contextSummary:
      "课程以态矢量、波函数、算符和表象为语言，讨论本征值问题、测量、角动量、全同粒子、近似方法和散射理论。",
  },
  {
    id: "thermo-stat",
    label: "热力学与统计物理",
    shortLabel: "热统",
    textbookReferences: ["汪志诚《热力学·统计物理》"],
    contextSummary:
      "课程连接宏观热力学描述与微观统计描述，强调热力学势的自然变量、Maxwell 关系、系综理论、经典统计、量子统计和涨落。",
  },
];

export function getCourseLabel(courseId?: CourseId) {
  if (!courseId || courseId === "general") {
    return "未指定课程";
  }

  return courseOptions.find((course) => course.id === courseId)?.label ?? "未指定课程";
}

export function getCourseContext(courseId?: CourseId) {
  if (!courseId || courseId === "general") {
    return "用户未显式指定课程。回答时先根据问题中的术语判断最可能的课程语境；如果存在多种理解，应说明不同语境下的区别，再选择最常见的大学物理专业课程版本作答。";
  }

  return courseOptions.find((course) => course.id === courseId)?.contextSummary ?? "";
}
