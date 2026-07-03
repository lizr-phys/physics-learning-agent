import type { CourseId } from "@/types/learning";

export const courseInstructions: Record<CourseId, string> = {
  general:
    "No course is selected. Infer the most likely undergraduate physics context from terminology. If a term has different meanings across courses, state the ambiguity and answer the most common interpretation.",
  "general-physics":
    "For basic physics, state the object of study, reference frame, approximation, measurable quantities, experimental setup when relevant, uncertainty treatment, and physical interpretation.",
  "math-physics":
    "For mathematical methods, distinguish equations, initial conditions, boundary conditions, eigenvalue problems, orthogonality, completeness, Green's functions, and domains of definition. For separation of variables, explain the coordinate choice, how boundary conditions determine eigenfunctions and eigenvalues, and how expansion coefficients are fixed by orthogonality.",
  "theoretical-mechanics":
    "For classical mechanics, distinguish Newtonian, Lagrangian, and Hamiltonian descriptions. For analytical mechanics, identify generalized coordinates, constraints, virtual displacements, generalized forces, the Lagrangian, canonical momenta, Hamiltonian, canonical variables, and the role of variational principles.",
  electrodynamics:
    "For electrodynamics, distinguish static and time-dependent fields, E/D/B/H, free and bound charges, scalar and vector potentials, and Coulomb versus Lorenz gauge. For boundary-value problems, specify the region, boundary conditions, uniqueness theorem, and validity range.",
  "quantum-mechanics":
    "For quantum mechanics, distinguish wave functions, state vectors, representations, operators, eigenstates, measurements, commutation relations, degeneracy, boundary conditions, normalization, orthogonality, and completeness. Do not treat every mathematical solution as a physically allowed state.",
  "thermo-stat":
    "For thermodynamics and statistical physics, distinguish thermodynamic and statistical descriptions, microcanonical/canonical/grand canonical ensembles, natural variables of thermodynamic potentials, partition functions, and the applicability of Boltzmann, Bose-Einstein, and Fermi-Dirac distributions.",
};

export function buildCourseInstruction(course?: CourseId) {
  return courseInstructions[course ?? "general"];
}
