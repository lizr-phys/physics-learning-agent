import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import katex from "katex";

import {
  ensureBlockMath,
  normalizeMarkdownMath,
  MarkdownRenderer,
} from "@/components/common/MarkdownRenderer";

describe("Markdown math normalization", () => {
  it("links only supplied citation indices and preserves code references", () => {
    const html = renderToStaticMarkup(createElement(MarkdownRenderer, {content:"Supported [1], absent [2], code `[1]`.",sourceCount:1,onSourceSelect:()=>undefined}));
    expect(html).toContain('aria-label="View source 1"');
    expect(html).toContain("absent [2]");
    expect(html).toContain("<code>[1]</code>");
  });
  it("preserves a tag inside an already delimited multiline display", () => {
    const input = "$$\nE=mc^2 \\tag{1}\n$$";
    expect(normalizeMarkdownMath(input)).toBe(input);
    const html = renderToStaticMarkup(createElement(MarkdownRenderer, {content: input}));
    expect(html).toContain("katex-display");
    expect(html).not.toContain("<p>E=mc");
  });

  it("renders GFM tables with formulas and retains prose after bad math", () => {
    const content = "| Symbol | Meaning |\n| --- | --- |\n| $E$ | Energy |\n\n$$\\unknowncommand{x}$$\n\nFollowing explanation.";
    const html = renderToStaticMarkup(createElement(MarkdownRenderer, {content}));
    expect(html).toContain("<table");
    expect(html).toContain("Following explanation.");
  });

  it("does not trust prototype-inherited KaTeX options", () => {
    const html = katex.renderToString(String.raw`\href{javascript:alert(1)}{click}`, Object.create({trust:true}));
    expect(html).not.toContain('href="javascript:');
  });

  it("repairs bare aligned math once and leaves code and existing aligned blocks intact", () => {
    const bare = String.raw`\begin{align}a&=b\tag{2}\\c&=d\end{align}`;
    expect((normalizeMarkdownMath(bare).match(/\$\$/g) ?? [])).toHaveLength(2);
    const existing = `$$\n${String.raw`\begin{aligned}a&=b\tag{2}\end{aligned}`}\n$$`;
    expect(normalizeMarkdownMath(existing)).toBe(existing);
    const code = "```tex\n$$\nE=mc^2 \\tag{1}\n$$\n```";
    expect(normalizeMarkdownMath(code)).toBe(code);
    expect(normalizeMarkdownMath("```tex\n\\[x\\]", true)).toBe("```tex\n\\[x\\]");
  });
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
