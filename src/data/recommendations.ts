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
    tags: ["basic physics", "measurement", "uncertainty", "waves", "conceptual reasoning"],
    chat: [
      "Explain when momentum conservation can be used safely",
      "How does Gauss's law become useful for finding electric fields?",
      "What assumptions justify the simple harmonic oscillator approximation?",
      "How do state variables differ from process quantities in thermodynamics?",
      "How should uncertainty be reported in a basic physics measurement?",
      "Explain common conceptual pitfalls about force and motion",
    ],
    practice: [
      "Generate 5 Newton's-law force-analysis problems",
      "Generate 3 momentum and mechanical energy problems",
      "Generate 5 thermal-process practice problems",
      "Generate 3 electromagnetic induction problems",
      "Generate 5 oscillation and wave problems",
      "Generate 3 measurement and uncertainty-analysis problems",
    ],
  },
  {
    course: "math-physics",
    tags: ["Green's functions", "separation of variables", "boundary-value problems", "Fourier", "Sturm-Liouville"],
    chat: [
      "Explain the physical meaning of Green's functions",
      "Why does separation of variables turn a boundary-value problem into an eigenvalue problem?",
      "What role does orthogonality play in Fourier series expansions?",
      "When is the Laplace transform the right tool for initial-value problems?",
      "What does the weight function mean in a Sturm-Liouville problem?",
      "How are analytic functions related to the Cauchy-Riemann equations?",
    ],
    practice: [
      "Generate 5 Fourier series expansion problems",
      "Generate 3 complex-variable analyticity problems",
      "Generate 5 Green's-function boundary-value problems",
      "Generate 5 Laplace-transform initial-value problems",
      "Generate 3 Sturm-Liouville eigenvalue problems",
      "Generate 5 separation-of-variables problems for the heat equation",
    ],
  },
  {
    course: "theoretical-mechanics",
    tags: ["Lagrange equations", "Hamiltonian mechanics", "constraints", "small oscillations", "rigid bodies"],
    chat: [
      "Why can Lagrange equations avoid writing constraint forces explicitly?",
      "How are generalized coordinates different from ordinary coordinates?",
      "Why is a virtual displacement not the same as an actual displacement?",
      "How are Hamilton's equations equivalent to Lagrange's equations?",
      "Why do Poisson brackets describe conserved quantities?",
      "What do normal coordinates accomplish in small-oscillation problems?",
    ],
    practice: [
      "Generate 5 generalized-coordinate modeling problems",
      "Generate 3 rigid-body fixed-axis rotation problems",
      "Generate 5 Lagrange-equation modeling problems",
      "Generate 3 normal-mode small-oscillation problems",
      "Generate 5 Hamilton canonical-equation problems",
      "Generate 3 non-inertial-frame dynamics problems",
    ],
  },
  {
    course: "electrodynamics",
    tags: ["Maxwell equations", "boundary-value problems", "image method", "electromagnetic waves", "gauge"],
    chat: [
      "What exactly does the uniqueness theorem guarantee in electrostatics?",
      "Why do we distinguish E and D inside matter?",
      "How do Coulomb gauge and Lorenz gauge differ?",
      "Why are electromagnetic potentials not unique?",
      "How do Maxwell's equations imply electromagnetic waves?",
      "How should I understand the far-field approximation in multipole expansion?",
    ],
    practice: [
      "Generate 5 Maxwell-equation application problems",
      "Generate 3 plane-wave boundary-condition problems",
      "Generate 5 electrostatic boundary-value problems",
      "Generate 3 image-method conductor-boundary problems",
      "Generate 5 electromagnetic-potential and gauge-transformation problems",
      "Generate 3 multipole-expansion far-field problems",
    ],
  },
  {
    course: "quantum-mechanics",
    tags: ["stationary states", "harmonic oscillator", "angular momentum", "perturbation theory", "spin"],
    chat: [
      "How do boundary conditions determine energy levels in one-dimensional stationary problems?",
      "Why are the harmonic oscillator energy eigenvalues discrete?",
      "What does a change of representation mean in quantum mechanics?",
      "How should I interpret angular-momentum commutation relations?",
      "What are the conditions for non-degenerate time-independent perturbation theory?",
      "Why does exchange symmetry matter for identical particles?",
    ],
    practice: [
      "Generate 5 harmonic oscillator ladder-operator problems",
      "Generate 3 spin-measurement problems",
      "Generate 5 one-dimensional stationary-state problems",
      "Generate 3 angular-momentum commutator problems",
      "Generate 5 time-independent perturbation theory problems",
      "Generate 3 identical-particle state-construction problems",
    ],
  },
  {
    course: "thermo-stat",
    tags: ["canonical ensemble", "thermodynamic potentials", "Maxwell relations", "quantum statistics", "fluctuations"],
    chat: [
      "What is the difference between the canonical and microcanonical ensembles?",
      "Why do the natural variables of thermodynamic potentials matter?",
      "How are the Boltzmann and Gibbs distributions related?",
      "When do Bose-Einstein and Fermi-Dirac distributions apply?",
      "How do Maxwell relations follow from thermodynamic potentials?",
      "Why does the partition function determine thermodynamic quantities?",
    ],
    practice: [
      "Generate 5 thermodynamic-potential natural-variable problems",
      "Generate 3 partition-function calculation problems",
      "Generate 5 canonical-ensemble problems",
      "Generate 3 Maxwell-relation application problems",
      "Generate 5 Bose-Einstein and Fermi-Dirac distribution problems",
      "Generate 3 phase-equilibrium condition problems",
    ],
  },
];

export const recommendationItems: RecommendationItem[] = seeds.flatMap((seed) =>
  (["chat", "practice"] as const).flatMap((type) =>
    seed[type].map((title, index) => ({
      id: `${seed.course}-${type}-${index + 1}`,
      type,
      course: seed.course,
      knowledgeTitle: title
        .replace(/^(Explain|Generate \d+|How|What|Why)\s*/i, "")
        .slice(0, 80),
      title,
      prompt: title,
      tags: seed.tags,
      difficulty: index < 2 ? "basic" : index < 4 ? "intermediate" : "advanced",
    })),
  ),
);
