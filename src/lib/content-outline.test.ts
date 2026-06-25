import { describe, expect, it } from "vitest";

import { extractContentOutline } from "@/lib/content-outline";

describe("content outline", () => {
  it("extracts second and third level headings outside code blocks", () => {
    const items = extractContentOutline(`## 题型定位

### 方程与条件

\`\`\`md
## 代码块标题
\`\`\`

## 检验方法`);

    expect(items.map((item) => item.title)).toEqual([
      "题型定位",
      "方程与条件",
      "检验方法",
    ]);
    expect(new Set(items.map((item) => item.id)).size).toBe(3);
  });
});
