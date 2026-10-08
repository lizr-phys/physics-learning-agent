type MarkdownNode = { type: string; value?: string; url?: string; children?: MarkdownNode[] };

/** Only supplied citation indices become controls; code/math/link nodes stay intact. */
export function remarkCitations(options: { count: number }) {
  return (tree: MarkdownNode) => {
    function visit(node: MarkdownNode) {
      if (!node.children || ["link", "code", "inlineCode", "math", "inlineMath"].includes(node.type)) return;
      node.children = node.children.flatMap(child => {
        if (child.type !== "text" || !child.value) { visit(child); return [child]; }
        const result: MarkdownNode[] = []; let start = 0;
        for (const match of child.value.matchAll(/\[(\d+)\]/g)) {
          const citation = Number(match[1]);
          if (citation < 1 || citation > options.count) continue;
          const index = match.index ?? 0;
          if (index > start) result.push({type:"text",value:child.value.slice(start,index)});
          result.push({type:"link",url:`#pla-source-${citation}`,children:[{type:"text",value:match[0]}]});
          start = index + match[0].length;
        }
        if (start < child.value.length) result.push({type:"text",value:child.value.slice(start)});
        return result.length ? result : [child];
      });
    }
    visit(tree);
  };
}
