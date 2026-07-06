import type { CourseId } from "@/types/learning";

export type CourseOption = {
  id: Exclude<CourseId, "general">;
  label: string;
  shortLabel: string;
  chineseReferences: string[];
  englishReferences: string[];
  contextSummary: string;
};

export const courseOptions: CourseOption[] = [
  {
    id: "general-physics",
    label: "General Physics",
    shortLabel: "General Physics",
    chineseReferences: ["Chinese university general physics curricula"],
    englishReferences: ["The Feynman Lectures on Physics", "Berkeley Physics Course"],
    contextSummary:
      "Units and vectors, Newtonian mechanics, gravitation, fluids, oscillations and waves, thermal physics, electromagnetism, circuits, optics, modern physics, measurement, uncertainty analysis, and conceptual physical reasoning.",
  },
  {
    id: "math-physics",
    label: "Mathematical Methods for Physics",
    shortLabel: "Math Methods",
    chineseReferences: ["Liang Kunmiao style Mathematical Methods in Physics", "Common Chinese mathematical physics lecture sequences"],
    englishReferences: [
      "Arfken, Weber, and Harris",
      "Riley, Hobson, and Bence",
      "Mary L. Boas",
      "Churchill and Brown",
      "Haberman",
    ],
    contextSummary:
      "Complex variables, Fourier analysis, integral transforms, partial differential equations, boundary-value problems, Sturm-Liouville theory, Green's functions, and special functions.",
  },
  {
    id: "theoretical-mechanics",
    label: "Classical Mechanics",
    shortLabel: "Mechanics",
    chineseReferences: ["Chinese analytical mechanics and classical mechanics course traditions"],
    englishReferences: ["Landau and Lifshitz Mechanics", "Goldstein, Poole, and Safko", "John R. Taylor", "Marion and Thornton"],
    contextSummary:
      "Newtonian mechanics, constrained systems, generalized coordinates, Lagrange equations, Hamilton's principle, canonical equations, Poisson brackets, rigid bodies, and small oscillations.",
  },
  {
    id: "electrodynamics",
    label: "Electrodynamics",
    shortLabel: "Electrodynamics",
    chineseReferences: ["Guo Shuohong style Electrodynamics"],
    englishReferences: ["Griffiths Introduction to Electrodynamics", "Jackson Classical Electrodynamics", "Zangwill", "Purcell and Morin"],
    contextSummary:
      "Electrostatics, magnetostatics, Maxwell equations, boundary-value problems, image method, multipole expansion, electromagnetic waves, potentials, gauge transformations, and radiation.",
  },
  {
    id: "quantum-mechanics",
    label: "Quantum Mechanics",
    shortLabel: "Quantum",
    chineseReferences: ["Zeng Jinyan", "Zhou Shixun"],
    englishReferences: ["Griffiths and Schroeter", "Sakurai and Napolitano", "Shankar", "Cohen-Tannoudji, Diu, and Laloe", "Townsend", "Zettili"],
    contextSummary:
      "Wave functions, state vectors, operators, representations, eigenvalue problems, measurement, angular momentum, spin, identical particles, perturbation theory, variational methods, WKB, and scattering.",
  },
  {
    id: "thermo-stat",
    label: "Thermodynamics and Statistical Physics",
    shortLabel: "Thermo/Stat",
    chineseReferences: ["Wang Zhicheng style Thermodynamics and Statistical Physics"],
    englishReferences: [
      "Schroeder Thermal Physics",
      "Reif",
      "Pathria and Beale",
      "Kerson Huang",
      "Callen",
      "Landau and Lifshitz Statistical Physics",
      "Kardar",
      "Blundell and Blundell",
    ],
    contextSummary:
      "Thermodynamic laws, thermodynamic potentials, Maxwell relations, phase equilibrium, ensembles, partition functions, classical statistics, quantum statistics, and fluctuations.",
  },
];

export function getCourseLabel(courseId?: CourseId) {
  if (!courseId || courseId === "general") {
    return "Unspecified course";
  }

  return courseOptions.find((course) => course.id === courseId)?.label ?? "Unspecified course";
}

export function getCourseContext(courseId?: CourseId) {
  if (!courseId || courseId === "general") {
    return "No course is explicitly selected. Infer the most likely physics course context from the terminology in the user request. If several contexts are plausible, state the ambiguity and answer the most common undergraduate physics interpretation.";
  }

  return courseOptions.find((course) => course.id === courseId)?.contextSummary ?? "";
}
