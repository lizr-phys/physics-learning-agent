# Contributing

Contributions should preserve the project's focus: a restrained, inspectable learning workspace for undergraduate physics. Prefer small, typed changes that fit the existing App Router, LangGraph, retrieval, and local-persistence boundaries.

## Development setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The server-side model key is optional for UI and mocked browser tests. A configured provider is required for live generation.

## Before opening a pull request

Run the complete verification suite:

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Please include focused tests for behavior changes. Retrieval work should cover ranking or document extraction, and chat work should preserve the `conversationId + assistantMessageId + requestId` isolation contract.

## Project conventions

- Keep user-facing interface copy in English; the generated response language follows the user's request.
- Keep provider keys out of source, logs, persistent browser storage, and workspace snapshots.
- Do not add copyrighted textbook content or copied course problem statements.
- Prefer existing components, types, and workflow nodes over parallel abstractions.
- Avoid large dependencies unless they replace substantial custom infrastructure.
- Document production assumptions when a feature uses the local single-process store.
