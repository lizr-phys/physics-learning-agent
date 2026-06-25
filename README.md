# Physics Learning Agent

Physics Learning Agent 是一个面向大学物理学习的对话式工具，主要覆盖数学物理方法、理论力学、电动力学、量子力学、热力学与统计物理等课程。

项目以连续对话为主要入口，同时提供知识点导览和练习题生成。它适合用于理解概念、检查推导和进行针对性习题训练。

## Features

- Chat-style physics learning assistant
- 国内本科物理课程知识目录
- 原创练习题生成，支持难度、数量和输出方式控制
- 练习题按题折叠，提示、解析和答案默认隐藏
- 长回答结构目录
- 统一的 Markdown、LaTeX、表格和代码块渲染
- 本地会话历史和轻量个性化推荐
- 回答深度控制：简洁、标准、详细、推导优先、题型优先
- DeepSeek 服务端流式调用与中断恢复
- 本地 Markdown 资料的轻量 RAG 检索

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- DeepSeek Chat API
- React Markdown
- KaTeX
- Vitest
- Playwright

## Getting Started

1. 安装依赖

```bash
npm install
```

2. 创建 `.env.local`

```txt
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=120000
```

3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

4. 构建生产版本

```bash
npm run build
```

## Main Pages

- `/chat`：聊天式学习工作台
- `/map`：课程知识目录
- `/practice`：练习题生成
- `/settings/api`：DeepSeek 配置状态和连接测试

## Testing

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

也可以运行完整检查：

```bash
npm run test:all
```

## API and Privacy

DeepSeek API Key 只由 Next.js 服务端读取。浏览器仅调用项目内部的 `/api/chat` 和 `/api/deepseek/test` 接口，不会获得 API Key。

会话历史和回答深度偏好保存在当前浏览器的 localStorage 中。项目没有账号系统，因此这些数据不会自动同步到其他设备或浏览器。

## RAG

当前 RAG 实现位于 `src/rag`，使用本地 Markdown 文档、文本分块和关键词检索，不依赖向量数据库。它用于验证教材笔记检索、片段注入和来源显示的基本链路。

后续可在保持现有接口的基础上增加 PDF/Markdown 导入、embedding 和向量库。不要将受版权保护的教材全文提交到公开仓库，建议使用个人笔记、讲义摘要和自整理习题解析。

更多架构说明见 [`docs/system-optimization.md`](docs/system-optimization.md) 和 [`src/rag/README.md`](src/rag/README.md)。

## Notes

模型生成的解释、推导和练习题用于学习辅助。正式课程作业和考试准备仍应结合教材、讲义和教师要求核对。

## License

MIT
