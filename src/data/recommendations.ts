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
    tags: [
      "general physics",
      "dimensional analysis",
      "mechanics",
      "fluids",
      "circuits",
      "optics",
      "modern physics",
      "measurement",
    ],
    chat: [
      "How do dimensional analysis and scaling arguments constrain a physical answer?",
      "Why is choosing a reference frame the first step in Newtonian mechanics?",
      "How are circular motion, centripetal acceleration, and non-inertial forces related?",
      "What physical assumptions enter Bernoulli's equation?",
      "How do RC transients connect circuit equations with exponential relaxation?",
      "What assumptions justify the simple harmonic oscillator approximation?",
      "How does geometrical optics follow from the short-wavelength approximation?",
      "How should uncertainty be reported in a general physics measurement?",
    ],
    practice: [
      "Generate 5 dimensional-analysis and unit-consistency problems",
      "Generate 5 Newton's-law force-analysis problems with changing reference frames",
      "Generate 3 gravitation and circular-orbit problems",
      "Generate 5 fluid statics and Bernoulli-equation problems",
      "Generate 5 DC circuit and RC transient problems",
      "Generate 3 geometrical-optics imaging problems",
      "Generate 3 photoelectric-effect and de Broglie-wavelength problems",
      "Generate 3 measurement and uncertainty-analysis problems",
    ],
  },
  {
    course: "math-physics",
    tags: ["Green's functions", "separation of variables", "boundary-value problems", "Fourier", "Sturm-Liouville"],
    chat: [
      "How do curvilinear coordinates change gradient, divergence, and Laplacian operators?",
      "Explain the physical meaning of Green's functions",
      "Why does separation of variables turn a boundary-value problem into an eigenvalue problem?",
      "How does the Dirac delta function enter source terms and Green's functions?",
      "What role does orthogonality play in Fourier series expansions?",
      "When is the Laplace transform the right tool for initial-value problems?",
      "What does the weight function mean in a Sturm-Liouville problem?",
      "Why do spherical harmonics appear in three-dimensional Laplace problems?",
    ],
    practice: [
      "Generate 5 Fourier series expansion problems",
      "Generate 3 complex-variable analyticity problems",
      "Generate 3 vector-analysis problems in cylindrical and spherical coordinates",
      "Generate 5 Green's-function boundary-value problems",
      "Generate 5 Laplace-transform initial-value problems",
      "Generate 3 Sturm-Liouville eigenvalue problems",
      "Generate 3 Dirac-delta distribution and source-term problems",
      "Generate 5 separation-of-variables problems for the heat equation",
    ],
  },
  {
    course: "theoretical-mechanics",
    tags: ["Lagrange equations", "Hamiltonian mechanics", "constraints", "small oscillations", "rigid bodies"],
    chat: [
      "Why can Lagrange equations avoid writing constraint forces explicitly?",
      "How are generalized coordinates different from ordinary coordinates?",
      "How do Lagrange multipliers represent constraint forces?",
      "Why is a virtual displacement not the same as an actual displacement?",
      "How does Noether's theorem connect symmetry with conservation laws?",
      "How are Hamilton's equations equivalent to Lagrange's equations?",
      "Why do Poisson brackets describe conserved quantities?",
      "What is the point of the Hamilton-Jacobi equation?",
    ],
    practice: [
      "Generate 5 generalized-coordinate modeling problems",
      "Generate 3 rigid-body fixed-axis rotation problems",
      "Generate 5 Lagrange-equation modeling problems",
      "Generate 3 Lagrange-multiplier constraint problems",
      "Generate 3 Noether-theorem conservation-law problems",
      "Generate 3 normal-mode small-oscillation problems",
      "Generate 5 Hamilton canonical-equation problems",
      "Generate 3 Hamilton-Jacobi separability problems",
    ],
  },
  {
    course: "electrodynamics",
    tags: ["Maxwell equations", "boundary-value problems", "image method", "electromagnetic waves", "gauge"],
    chat: [
      "What exactly does the uniqueness theorem guarantee in electrostatics?",
      "Why do we distinguish E and D inside matter?",
      "How do electromagnetic boundary conditions follow from Maxwell's equations?",
      "What does Poynting's theorem say about field energy and power flow?",
      "How do Coulomb gauge and Lorenz gauge differ?",
      "Why are electromagnetic potentials not unique?",
      "How do Maxwell's equations imply electromagnetic waves?",
      "What makes a waveguide mode different from a free-space plane wave?",
    ],
    practice: [
      "Generate 5 Maxwell-equation application problems",
      "Generate 3 plane-wave boundary-condition problems",
      "Generate 5 electrostatic boundary-value problems",
      "Generate 3 dielectric-interface boundary-condition problems",
      "Generate 3 image-method conductor-boundary problems",
      "Generate 3 Poynting-theorem energy-flow problems",
      "Generate 5 electromagnetic-potential and gauge-transformation problems",
      "Generate 3 rectangular-waveguide mode problems",
    ],
  },
  {
    course: "quantum-mechanics",
    tags: ["stationary states", "harmonic oscillator", "angular momentum", "perturbation theory", "spin"],
    chat: [
      "How does Dirac notation separate the state from its representation?",
      "How do boundary conditions determine energy levels in one-dimensional stationary problems?",
      "What changes after a quantum measurement?",
      "Why are the harmonic oscillator energy eigenvalues discrete?",
      "What does a change of representation mean in quantum mechanics?",
      "How should I interpret angular-momentum commutation relations?",
      "How do Clebsch-Gordan coefficients enter angular-momentum addition?",
      "What are the conditions for non-degenerate time-independent perturbation theory?",
      "When is the WKB approximation valid?",
    ],
    practice: [
      "Generate 5 harmonic oscillator ladder-operator problems",
      "Generate 3 spin-measurement problems",
      "Generate 5 one-dimensional stationary-state problems",
      "Generate 3 angular-momentum commutator problems",
      "Generate 3 angular-momentum addition problems",
      "Generate 5 time-independent perturbation theory problems",
      "Generate 3 WKB quantization problems",
      "Generate 3 identical-particle state-construction problems",
    ],
  },
  {
    course: "thermo-stat",
    tags: ["canonical ensemble", "thermodynamic potentials", "Maxwell relations", "quantum statistics", "fluctuations"],
    chat: [
      "How do equilibrium and state functions constrain thermodynamic reasoning?",
      "What is the difference between the canonical and microcanonical ensembles?",
      "Why do the natural variables of thermodynamic potentials matter?",
      "What does the chemical potential measure physically?",
      "How are the Boltzmann and Gibbs distributions related?",
      "When do Bose-Einstein and Fermi-Dirac distributions apply?",
      "How do Maxwell relations follow from thermodynamic potentials?",
      "What changes in the low-temperature limit of a degenerate Fermi gas?",
    ],
    practice: [
      "Generate 5 thermodynamic-potential natural-variable problems",
      "Generate 3 partition-function calculation problems",
      "Generate 3 chemical-potential and open-system problems",
      "Generate 5 canonical-ensemble problems",
      "Generate 3 Maxwell-relation application problems",
      "Generate 5 Bose-Einstein and Fermi-Dirac distribution problems",
      "Generate 3 Bose-condensation and Fermi-gas problems",
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
