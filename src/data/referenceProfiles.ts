import type { CourseId, DetectedLanguage, PracticeStyleId, ReferenceProfileId } from "@/types/learning";

export type ReferenceProfile = {
  id: ReferenceProfileId;
  label: string;
  responseInstruction: string;
  practiceInstruction: string;
};

export const referenceProfiles: Record<ReferenceProfileId, ReferenceProfile> = {
  auto: {
    id: "auto",
    label: "Auto",
    responseInstruction:
      "Infer the suitable reference tradition from the user's language and explicit style request.",
    practiceInstruction:
      "Use the user's language and requested style to choose the exercise convention. Generate original problems only.",
  },
  chinese: {
    id: "chinese",
    label: "Chinese undergraduate physics tradition",
    responseInstruction:
      "Use natural Chinese academic phrasing when answering in Chinese. Prefer common terminology from Chinese undergraduate physics courses, Chinese final exams, postgraduate entrance exam training, and Chinese after-chapter exercise conventions.",
    practiceInstruction:
      "For Chinese requests, generate original variants in the style of Chinese textbook exercises, Chinese university final exams, or postgraduate entrance exam training. Do not copy textbook or exam questions, do not claim any exact source, and make all conditions complete.",
  },
  english: {
    id: "english",
    label: "English textbook and open-course tradition",
    responseInstruction:
      "Use natural academic English when answering in English. Prefer standard English textbook terminology and problem-set conventions from established undergraduate and graduate physics courses.",
    practiceInstruction:
      "For English requests, generate original variants in the style of English textbook exercises or open-course problem sets. Do not copy textbook or MIT OCW problems, do not claim official source status, and make all assumptions and boundary conditions explicit.",
  },
};

const styleReference: Record<PracticeStyleId, ReferenceProfileId> = {
  auto: "auto",
  "chinese-textbook": "chinese",
  "chinese-final-exam": "chinese",
  "chinese-postgraduate-exam": "chinese",
  "english-textbook": "english",
  "open-course": "english",
};

export function resolveReferenceProfile(input: {
  language?: DetectedLanguage;
  practiceStyle?: PracticeStyleId;
  referenceProfile?: ReferenceProfileId;
}): ReferenceProfileId {
  if (input.referenceProfile && input.referenceProfile !== "auto") {
    return input.referenceProfile;
  }

  const styleProfile = styleReference[input.practiceStyle ?? "auto"] ?? "auto";
  if (styleProfile !== "auto") {
    return styleProfile;
  }

  return input.language === "zh" ? "chinese" : "english";
}

export function resolvePracticeStyle(input: {
  language?: DetectedLanguage;
  practiceStyle?: PracticeStyleId;
}): PracticeStyleId {
  if (input.practiceStyle && input.practiceStyle !== "auto") {
    return input.practiceStyle;
  }

  return input.language === "zh" ? "chinese-textbook" : "english-textbook";
}

export function describePracticeStyle(style: PracticeStyleId) {
  switch (style) {
    case "chinese-textbook":
      return "Chinese textbook exercise style";
    case "chinese-final-exam":
      return "Chinese university final-exam style";
    case "chinese-postgraduate-exam":
      return "Chinese postgraduate-entrance-exam style";
    case "english-textbook":
      return "English textbook exercise style";
    case "open-course":
      return "Open-course problem-set style";
    default:
      return "Auto";
  }
}

const englishReferenceByCourse: Record<CourseId, string> = {
  general:
    "Use standard undergraduate general physics terminology, with conceptual style guided by The Feynman Lectures on Physics and the Berkeley Physics Course.",
  "general-physics":
    "Use general physics conventions from The Feynman Lectures on Physics and the Berkeley Physics Course, emphasizing conceptual structure, physical reasoning, and well-posed quantitative examples.",
  "math-physics":
    "Use English mathematical physics conventions from Arfken-Weber-Harris, Riley-Hobson-Bence, Boas, Churchill-Brown, and Haberman.",
  "theoretical-mechanics":
    "Use mechanics conventions from Landau-Lifshitz, Goldstein, Taylor, and Marion-Thornton.",
  electrodynamics:
    "Use electrodynamics conventions from Griffiths, Jackson, Zangwill, Purcell-Morin, and open-course E&M assignments.",
  "quantum-mechanics":
    "Use quantum mechanics conventions from Griffiths-Schroeter, Sakurai-Napolitano, Shankar, Cohen-Tannoudji, Townsend, and Zettili problem styles.",
  "thermo-stat":
    "Use thermal and statistical physics conventions from Schroeder, Reif, Pathria-Beale, Huang, Callen, Landau-Lifshitz, Kardar, and Blundell.",
};

const chineseReferenceByCourse: Record<CourseId, string> = {
  general:
    "Use Chinese university general physics conventions with clear physical reasoning and complete problem conditions.",
  "general-physics":
    "Use Chinese general physics course conventions, with reference style aligned to concept-first treatments such as The Feynman Lectures on Physics and the Berkeley Physics Course.",
  "math-physics":
    "Use Chinese mathematical physics conventions in the Liang Kunmiao tradition: complex variables, Fourier analysis, PDE boundary-value problems, Sturm-Liouville theory, Green's functions, and special functions.",
  "theoretical-mechanics":
    "Use classical mechanics conventions: Newtonian mechanics, constraints, generalized coordinates, Lagrange equations, Hamiltonian formalism, rigid bodies, central forces, and small oscillations.",
  electrodynamics:
    "Use Chinese electrodynamics conventions in the Guo Shuohong tradition: electrostatic boundary-value problems, image method, multipole expansion, Maxwell equations, electromagnetic waves, potentials, and gauge transformations.",
  "quantum-mechanics":
    "Use Chinese quantum mechanics conventions in the Zeng Jinyan and Zhou Shixun traditions: one-dimensional stationary states, oscillator, angular momentum, spin, perturbation theory, and scattering basics.",
  "thermo-stat":
    "Use Chinese thermodynamics and statistical physics conventions in the Wang Zhicheng tradition: thermodynamic potentials, Maxwell relations, ensembles, partition functions, Bose-Einstein and Fermi-Dirac distributions, and phase transitions.",
};

export function buildCourseReferenceInstruction(course: CourseId | undefined, profile: ReferenceProfileId) {
  const selectedCourse = course ?? "general";
  if (profile === "chinese") {
    return chineseReferenceByCourse[selectedCourse];
  }
  if (profile === "english") {
    return englishReferenceByCourse[selectedCourse];
  }
  return `${chineseReferenceByCourse[selectedCourse]}\n${englishReferenceByCourse[selectedCourse]}`;
}
