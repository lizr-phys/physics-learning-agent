# Physics Learning Agent

面向国内大学物理专业本科课程的 AI 学习 Agent。项目采用 ChatGPT 式学习工作台：左侧管理学习会话和功能入口，中间用于连续提问、阅读推导和查看练习解析，底部固定输入框负责发起请求。DeepSeek API 只在服务端调用，前端不暴露 API Key。

## 项目简介

Physics Learning Agent 是一个面向物理专业本科生的开源学习工作台，覆盖普通物理、数学物理方法、理论力学、电动力学、量子力学以及热力学与统计物理。

它不只是 DeepSeek 的聊天界面，而是在模型调用前后增加了意图识别、课程上下文、知识点约束、结构化记忆、轻量 RAG、教师式回答模板和流式会话隔离。项目可用于概念理解、公式推导、习题解析、原创练习题生成、题型梳理和阶段复习。

主要特点：

- ChatGPT 式连续对话与本地会话管理。
- 贴合国内大学物理课程术语和训练方式。
- Markdown、LaTeX、表格和代码块渲染。
- 练习题、题型梳理和板块复习工具。
- 短期上下文、会话摘要和轻量长期学习画像。
- DeepSeek 服务端流式调用，API Key 不进入浏览器。
- 严格绑定会话、消息和请求，避免流式内容串线。
- Vitest 与 Playwright 自动化测试覆盖桌面端和移动端。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS
- DeepSeek Chat Completions API
- React Markdown + remark-math + rehype-katex + KaTeX
- lucide-react
- 本地 Markdown 样例资料 + 轻量关键词检索，为后续 RAG 做预留

## 主要页面

- `/`：默认进入 ChatGPT 式学习工作台
- `/chat`：同一套学习工作台，可通过 URL 参数带入课程、任务类型和知识点
- `/map`：课程目录式知识点导览，左侧课程、中间知识点、右侧详情
- `/practice`：练习题生成，支持课程、知识点、难度、数量、提示和解析选项
- `/types`：题型梳理，输出题型识别、建模步骤、方程建立和常见错误
- `/review`：板块复习，生成知识结构、公式、题型和复习建议
- `/settings/api`：DeepSeek API 配置状态、模型选择和连接测试

## 本次升级内容

- 前端改为学习工作台布局：Sidebar、会话历史、顶部上下文栏、消息列表和底部固定输入框。
- 会话历史使用 localStorage 保存，按“今天 / 最近 7 天 / 更早”分组。
- 聊天输入支持 Enter 发送、Shift + Enter 换行、请求中停止生成。
- `/api/chat` 支持流式返回，前端边生成边显示，并对流式内容做节流更新。
- 新增 `/api/deepseek/test`，用于读取服务端环境变量并测试 DeepSeek 连接。
- 新增 `/settings/api`，显示 API 状态、Base URL、服务端模型、浏览器会话模型和配置说明。
- 新增 `src/rag`，提供本地 Markdown 样例资料、chunk 和关键词检索逻辑。
- prompt 构造按课程、任务和选中知识点动态注入上下文，不再把完整知识库塞进每次请求。

## 项目结构

```txt
src/
  app/
    page.tsx
    chat/page.tsx
    map/page.tsx
    practice/page.tsx
    types/page.tsx
    review/page.tsx
    settings/api/page.tsx
    api/chat/route.ts
    api/deepseek/test/route.ts
  components/
    layout/
      AppShell.tsx
      Sidebar.tsx
    chat/
      ChatWorkspace.tsx
      TopContextBar.tsx
      ChatWindow.tsx
      ChatMessage.tsx
      ChatInput.tsx
      WelcomePrompts.tsx
    common/
      MarkdownRenderer.tsx
      LoadingAnswer.tsx
      ErrorMessage.tsx
    selectors/
      CourseSelector.tsx
      TaskTypeSelector.tsx
      KnowledgeSelector.tsx
  data/
    courses.ts
    knowledge.ts
    problemTypes.ts
    promptTemplates.ts
  lib/
    deepseek.ts
    prompt-builder.ts
    knowledge-utils.ts
    read-agent-stream.ts
    storage.ts
  rag/
    README.md
    types.ts
    chunk.ts
    retrieve.ts
    sample-docs/
      math-physics.md
      electrodynamics.md
```

## 安装

```bash
npm install
```

## 配置 DeepSeek

复制环境变量示例：

```bash
cp .env.example .env.local
```

填写 `.env.local`：

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_THINKING=disabled
DEEPSEEK_TIMEOUT_MS=120000
```

说明：

- `DEEPSEEK_API_KEY` 只由服务端读取，前端不会拿到这个值。
- `DEEPSEEK_MODEL` 可使用当前服务支持的模型。本项目允许 `deepseek-v4-flash`、`deepseek-v4-pro`、`deepseek-chat`、`deepseek-reasoner`。
- `/settings/api` 中的模型选择存储在当前浏览器 localStorage，只影响会话请求参数，不保存 API Key。

## 启动开发环境

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

## 检查

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

完整检查可使用：

```bash
npm run test:all
```

也可以访问：

- [http://localhost:3000/settings/api](http://localhost:3000/settings/api) 查看服务端配置状态。
- [http://localhost:3000/api/deepseek/test?mode=status](http://localhost:3000/api/deepseek/test?mode=status) 查看不发起模型调用的配置状态。
- [http://localhost:3000/api/deepseek/test](http://localhost:3000/api/deepseek/test) 发起一次服务端连接测试。

## DeepSeek 调用链路

前端只请求内部接口 `/api/chat`。API Route 会清洗参数、按需检索本地 RAG 样例片段，然后调用 `src/lib/deepseek.ts` 中的 DeepSeek 服务端模块。

调用流程：

1. 前端立即插入用户消息和空的 AI 消息。
2. `/api/chat` 根据 `course`、`taskType`、`knowledgePoint`、`difficulty`、`exerciseCount`、`useRag` 等参数构造请求。
3. `src/lib/prompt-builder.ts` 只加入当前课程、当前知识点和少量相关上下文。
4. `streamDeepSeek()` 向 DeepSeek 发送 `stream: true` 请求。
5. 服务端把上游 SSE 转换为纯文本流返回给前端。
6. 前端用 `ReadableStream` 边读边显示，并用 AbortController 支持停止生成。

## Agent 工作流与记忆

核心 Agent 逻辑位于 `src/agent`，按输入理解、上下文解析、RAG 检索、生成准备、响应后处理和记忆更新分层。一次流式请求绑定 `conversationId + assistantMessageId + requestId`，新建、删除或切换会话会取消旧请求，迟到的 chunk 也会被守卫丢弃。

记忆分为三层：

- 近期消息：受消息数和字符预算约束。
- 会话记忆：课程、知识点、学习目标、困惑、已讨论概念和对话摘要。
- 长期学习画像：课程频率、最近主题和讲解风格偏好，保存在浏览器 localStorage。

详细设计和测试说明见 [`docs/system-optimization.md`](docs/system-optimization.md)。

## RAG 当前能力

当前版本没有引入向量数据库，也没有假设 DeepSeek 提供 embedding。`src/rag` 使用本地 Markdown 样例资料和关键词检索：

- `sample-docs/math-physics.md`：数学物理方法样例片段
- `sample-docs/electrodynamics.md`：电动力学样例片段
- `chunk.ts`：按 Markdown 标题和段落切分文本
- `retrieve.ts`：根据问题关键词返回 2 到 4 个相关片段

聊天页可以打开“使用本地知识库”。开启后，`/api/chat` 会检索样例资料，并把片段标题、来源文件和摘要加入 prompt。回答引用文档名和片段标题，不伪造页码。

## 后续 RAG 扩展路线

1. 当前版本：本地 Markdown + 简单关键词检索。
2. 下一步：支持上传 Markdown、LaTeX 讲义和个人学习笔记。
3. 再下一步：支持 PDF/PPT 文档解析、清洗、分块和索引。
4. 检索升级：接入 embedding provider 和向量库，例如 LanceDB、Chroma、pgvector 或 Supabase Vector。
5. 引用升级：引用文档名、章节名、片段标题；只有在可靠解析页码时才显示页码。
6. 版权边界：不要把受版权保护的教材全文提交到公开仓库，建议只在本地使用个人笔记、讲义摘要和自整理习题解析。

## 课程知识库

本地知识库面向国内大学物理专业教材体系，覆盖：

- 数学物理方法
- 理论力学
- 电动力学
- 量子力学
- 热力学与统计物理

知识点数据包含中文术语、别名、教材式说明、前置知识、相关知识、常见题型、常用公式、易错点、学习顺序和难度。稳定的知识点简介、前置关系和常见题型优先由本地知识库展示；只有提问、推导、练习题生成、题型梳理和复习总结才调用 DeepSeek。
