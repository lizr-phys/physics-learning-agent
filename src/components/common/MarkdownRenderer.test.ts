import { describe, expect, it } from "vitest";

import {
  ensureBlockMath,
  normalizeMarkdownMath,
} from "@/components/common/MarkdownRenderer";

describe("Markdown math normalization", () => {
  it("normalizes common LaTeX delimiters outside code", () => {
    const input = [
      "行内公式 \\(E=mc^2\\)。",
      "\\[",
      "\\nabla^2\\varphi=0",
      "\\]",
      "`\\(code\\)`",
      "```tex",
      "\\[x^2\\]",
      "```",
    ].join("\n");

    const normalized = normalizeMarkdownMath(input);

    expect(normalized).toContain("行内公式 $E=mc^2$。");
    expect(normalized).toContain("$$\n\\nabla^2\\varphi=0\n$$");
    expect(normalized).toContain("`\\(code\\)`");
    expect(normalized).toContain("```tex\n\\[x^2\\]\n```");
  });

  it("converts display environments and naked tags", () => {
    const normalized = normalizeMarkdownMath(
      [
        "\\begin{equation}",
        "E=mc^2",
        "\\end{equation}",
        "u_x=v_y=e^x\\cos y\\tag{1}",
      ].join("\n"),
    );

    expect(normalized).toContain("$$\nE=mc^2\n$$");
    expect(normalized).toContain("$$\nu_x=v_y=e^x\\cos y\\tag{1}\n$$");
  });

  it("temporarily closes incomplete streaming math", () => {
    expect(normalizeMarkdownMath("结果为 $E=mc^2", true)).toBe(
      "结果为 $E=mc^2$",
    );
    expect(normalizeMarkdownMath("由下式得到：\n$$\nE_n=", true)).toBe(
      "由下式得到：\n$$\nE_n=\n$$",
    );
  });

  it("wraps knowledge formulas as display math", () => {
    expect(ensureBlockMath("\\nabla\\cdot\\boldsymbol E=\\rho/\\varepsilon_0")).toBe(
      "$$\n\\nabla\\cdot\\boldsymbol E=\\rho/\\varepsilon_0\n$$",
    );
    expect(ensureBlockMath("$E=mc^2$")).toBe("$$\nE=mc^2\n$$");
  });
});
