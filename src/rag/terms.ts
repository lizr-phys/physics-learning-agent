// Curated, conservative concept aliases. These expand terminology, not document metadata.
export const physicsTermAliases: Array<{ key: string; aliases: string[] }> = [
  { key: "newton_second_law", aliases: ["Newton's second law", "Newton second law", "牛顿第二定律"] },
  { key: "harmonic_oscillator", aliases: ["harmonic oscillator", "harmonic oscillation", "简谐振动", "谐振子"] },
  { key: "kirchhoff_laws", aliases: ["Kirchhoff laws", "Kirchhoff's laws", "基尔霍夫定律"] },
  { key: "thin_lens", aliases: ["thin lens", "薄透镜"] },
  { key: "green_function", aliases: ["Green function", "Green's function", "格林函数", "Green 函数"] },
  { key: "fourier_transform", aliases: ["Fourier transform", "傅里叶变换"] },
  { key: "sturm_liouville", aliases: ["Sturm Liouville", "Sturm-Liouville", "施图姆 刘维尔", "斯图姆 刘维尔"] },
  { key: "bessel_function", aliases: ["Bessel function", "贝塞尔函数"] },
  { key: "hamilton_equations", aliases: ["Hamilton equations", "Hamilton's equations", "Hamiltonian equations", "哈密顿正则方程", "哈密顿方程", "正则方程"] },
  { key: "lagrange_equations", aliases: ["Lagrange equations", "Lagrange's equations", "Lagrangian equations", "拉格朗日方程"] },
  { key: "poisson_bracket", aliases: ["Poisson bracket", "泊松括号"] },
  { key: "central_force", aliases: ["central force", "central-force", "中心力"] },
  { key: "maxwell_equations", aliases: ["Maxwell equations", "Maxwell's equations", "麦克斯韦方程", "Maxwell 方程"] },
  { key: "image_method", aliases: ["image method", "method of images", "镜像法"] },
  { key: "gauge_transformation", aliases: ["gauge transformation", "规范变换"] },
  { key: "multipole_expansion", aliases: ["multipole expansion", "多极展开"] },
  { key: "uncertainty_principle", aliases: ["uncertainty principle", "不确定性原理", "不确定关系"] },
  { key: "quantum_spin", aliases: ["quantum spin", "spin angular momentum", "量子自旋", "自旋角动量"] },
  { key: "quantum_tunneling", aliases: ["quantum tunneling", "quantum tunnelling", "量子隧穿"] },
  { key: "quantum_perturbation", aliases: ["quantum perturbation", "perturbation theory", "量子微扰", "微扰理论"] },
  { key: "canonical_ensemble", aliases: ["canonical ensemble", "正则系综"] },
  { key: "partition_function", aliases: ["partition function", "配分函数"] },
  { key: "chemical_potential", aliases: ["chemical potential", "化学势"] },
  { key: "bose_einstein", aliases: ["Bose Einstein distribution", "Bose-Einstein distribution", "玻色 爱因斯坦分布", "玻色分布"] },
  { key: "boundary_conditions", aliases: ["boundary condition", "边界条件"] },
  { key: "normalization", aliases: ["normalization", "normalisation", "归一化"] },
];

export function expandPhysicsTerms(text: string) {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/[‐‑‒–—]/g, "-");
  const concepts = physicsTermAliases.filter(({ aliases }) => aliases.some((alias) => {
    const target = alias.toLowerCase();
    if (/[\u3400-\u9fff]/.test(target)) return normalized.includes(target);
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // English singular aliases also match the corresponding plural, but not longer unrelated words.
    return new RegExp(`(?<![a-z])${escaped}s?(?![a-z])`, "i").test(normalized);
  })).map(({ key }) => `physics_${key}`);
  return `${text}\n${concepts.join(" ")}`;
}
