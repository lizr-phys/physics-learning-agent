# Physics Learning Agent

Physics Learning Agent is a focused learning workspace for undergraduate physics. It combines a ChatGPT-style conversation interface with structured course knowledge, practice problem generation, LaTeX rendering, and server-side DeepSeek integration.

The project is designed for students who need to review concepts, check derivations, and train with physics problems across the standard undergraduate curriculum: mathematical methods in physics, theoretical mechanics, electrodynamics, quantum mechanics, and thermodynamics and statistical physics.

## Features

- Chat-style physics learning assistant with local conversation history
- Knowledge map for core undergraduate physics topics
- Practice problem generation with difficulty, count, and output-mode controls
- Folded practice problem cards with hidden hints, solutions, and answers
- Markdown, LaTeX, tables, and code block rendering across the app
- Streaming DeepSeek responses through server-side API routes
- Session isolation for switching, deleting, and creating conversations during generation
- Lightweight local personalization based on recent learning history
- Answer-depth control for concise, standard, detailed, derivation-first, and problem-type-first responses
- Minimal local RAG prototype based on Markdown notes and keyword retrieval

## Product Scope

The current version keeps the product deliberately small:

- `/chat` provides the main conversation workspace.
- `/map` provides the course knowledge directory.
- `/practice` generates original practice problems and explanations.
- `/settings/api` shows DeepSeek configuration and connection status.

Topic review and problem-type analysis pages have been removed to keep the interface centered on conversation, knowledge navigation, and practice.

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

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```txt
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=120000
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Build for production:

```bash
npm run build
```

## Testing

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Or run the full validation pipeline:

```bash
npm run test:all
```

## API and Privacy

The DeepSeek API key is read only on the Next.js server side. The browser calls internal routes such as `/api/chat` and `/api/deepseek/test`; it never receives the API key.

Conversation history, answer-depth preference, and lightweight personalization data are stored in the current browser's `localStorage`. There is no account system or remote user database in the current version.

## RAG Prototype

The lightweight RAG prototype lives in `src/rag`. It uses local Markdown files, text chunking, and keyword retrieval to validate the basic flow of local note retrieval, context injection, and source display.

The next natural step is to support user-owned Markdown, PDF, or LaTeX notes, then add embeddings and a vector store such as LanceDB, Chroma, pgvector, or Supabase Vector. Copyrighted textbook content should not be committed to the public repository.

More implementation details are available in [`docs/system-optimization.md`](docs/system-optimization.md) and [`src/rag/README.md`](src/rag/README.md).

## Notes

Generated explanations, derivations, and practice problems are intended for learning support. For formal coursework, results should be checked against textbooks, lecture notes, and instructor requirements.

## License

MIT
