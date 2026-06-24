# RAG 预留说明

当前版本是轻量 RAG 骨架，不依赖向量数据库，也不假设 DeepSeek 提供 embedding。

## 当前实现

- `sample-docs/`：本地 Markdown 样例资料。
- `chunk.ts`：按 Markdown 标题切分，再按段落控制片段长度。
- `retrieve.ts`：基于关键词的简单评分检索，返回相关片段标题、来源和内容。
- `/api/chat`：当 `useRag: true` 时检索 2 到 4 个片段并加入 prompt。

## 后续扩展路线

1. 支持上传 PDF / Markdown / LaTeX 讲义。
2. 抽取文本，按章节、标题、公式上下文切分。
3. 选择中文效果稳定的 embedding provider。
4. 引入向量库，例如 LanceDB、Chroma、pgvector 或 Supabase Vector。
5. 在回答末尾引用文档名、章节名、片段标题，不编造页码。

## 版权注意

不要把受版权保护的教材全文提交到公开仓库。建议只放个人学习笔记、讲义摘要、自己整理的题解或有授权的公开材料。
