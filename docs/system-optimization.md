# Physics Learning Agent 系统架构

## 1. 请求生命周期

当前请求链路按明确阶段组织：

1. 前端创建 `conversationId`、`assistantMessageId` 和 `requestId`。
2. 会话层立即保存用户消息和空的 assistant 消息。
3. `intent-classifier` 判断物理学习、练习题、学习规划、通用问题或助手元问题。
4. `context-manager` 在字符预算内选择近期消息，并用结构化记忆补充较早上下文。
5. `workflow` 解析课程与知识点，按需检索本地 RAG 片段。
6. `prompt-builder` 根据意图、课程、任务和内部角色生成教学任务。
7. `deepseek` 发起服务端流式请求，转发文本和完成/错误控制事件。
8. 前端只允许匹配当前 `conversationId + assistantMessageId + requestId` 的 chunk 更新会话。
9. 完成后保存消息、会话摘要和长期学习画像；中断时保留部分内容并允许继续生成。

## 2. Agent 模块

```text
src/agent/
  intent-classifier.ts       # 高层任务意图
  context-manager.ts         # 短期上下文选择与摘要
  memory-manager.ts          # 会话记忆和长期学习画像
  exercise-parser.ts         # 自然语言课程、知识点、难度、数量解析
  generation-guard.ts        # 流式请求三元组隔离
  model-config.ts            # 按任务分配 temperature 和 max_tokens
  response-post-processor.ts # 通用问题提醒等确定性后处理
  workflow.ts                # 服务端 Agent 工作流编排
```

该结构借鉴状态机思想，但没有引入 LangGraph 或多 Agent 框架。每次仍然只进行一次主模型调用，内部角色通过 prompt 分工完成：

- 物理教师：概念、推导与解题。
- 学习教练：路径、误区和复习。
- 出题教师：原创题目、答案与解析。
- 严谨审稿者：条件、公式、符号和适用范围自检。
- 通用助手：处理非物理问题。

## 3. 记忆策略

### 短期上下文

- 从当前会话末尾向前选择消息。
- 同时限制消息数量和总字符数。
- 优先保留最近追问，避免把完整历史暴力放入 prompt。

### 会话记忆

每个会话保存：

- 当前课程与知识点。
- 当前学习目标。
- 最近困惑。
- 已讨论概念。
- 最近练习方向。
- 用户偏好的讲解粒度。
- 压缩后的会话摘要。

### 长期画像

浏览器本地保存轻量画像：

- 各课程出现频率。
- 最近学习主题。
- 讲解风格偏好。

长期画像只用于推荐和上下文提示，不保存 API Key，也不替代完整会话记录。

## 4. 流式稳定性

- 服务端只对建立 DeepSeek 连接设置超时，不再用固定 120 秒强行终止持续输出。
- 前端使用按 chunk 重置的 idle timeout。
- 上游 SSE 支持跨 chunk 缓冲，不假设一段网络数据就是完整 JSON。
- 服务端向前端发送 `done`、`length` 和 `error` 控制事件。
- 没有完成标记、达到长度上限、网络中断或半截公式都会保留部分内容并提供继续生成。
- 流式阶段显示轻量纯文本，完成后再执行 Markdown 与 KaTeX 渲染。

## 5. 会话隔离

一次生成必须同时匹配：

```text
conversationId + assistantMessageId + requestId
```

新建、切换或删除会话时会取消当前请求。即使旧请求晚到，`generation-guard` 也会拒绝写入；持久化前还会检查目标会话是否仍然存在，避免已删除会话被异步更新重新创建。

## 6. 练习题自然语言解析

练习题、题型和复习工具页允许两种输入并存：

- 表单明确选择课程与知识点。
- 在自然语言中写明课程、知识点、难度和题量。

未选择课程但文本明确时自动识别；表单课程和文本课程冲突时停止生成并提示用户处理，不会静默套用错误模板。

## 7. 测试

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

单元测试覆盖意图分类、prompt、上下文压缩、记忆、练习参数、模型参数、流解析、会话清理和后处理。Playwright 使用本地模拟流，不消耗 DeepSeek 配额，覆盖桌面与移动端的新建/删除/切换会话、课程自动识别、KaTeX 和横向溢出。

## 8. 参考设计

只吸收架构思想，不复制实现：

- OpenHands：事件生命周期、错误恢复和状态隔离。
- LangGraph：输入理解、上下文、检索、生成、记忆和错误节点的分层。
- CrewAI / MetaGPT：轻量角色职责分工。
- Letta：短期上下文与长期记忆分离。
- Open Deep Research：复杂问题先定位再组织答案。
- AutoGPT：任务拆解、完整性检查和失败续写。
- Microsoft Agent Framework：workflow、state、memory、tool、test 分层。
