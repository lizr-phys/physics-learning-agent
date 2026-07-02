# Physics Learning Agent

Physics Learning Agent is a minimal chat-style learning workspace for undergraduate physics. It combines conversation, course-structured knowledge, original practice problem generation, Markdown/LaTeX rendering, and server-side DeepSeek integration in a focused interface.

The project is designed for students who want to review concepts, check derivations, practice problem solving, and keep lightweight local study context across core physics courses.

## Features

- Chat-style learning assistant with local conversation history
- Bilingual response strategy for Chinese and English questions
- Knowledge map for core undergraduate physics topics
- Original practice problem generation with difficulty, count, output-mode, and source-style controls
- Folded practice problem cards with hints, solutions, and answers hidden by default
- Markdown, LaTeX, tables, and code block rendering across the app
- Streaming DeepSeek responses through server-side API routes
- Session isolation when switching, deleting, or creating conversations during generation
- Lightweight local personalization based on recent learning history
- Answer-depth control: concise, standard, detailed, derivation-first, and problem-style-first
- Minimal local RAG prototype based on Markdown notes and keyword retrieval

## Course Coverage

The current knowledge structure focuses on the standard undergraduate physics curriculum:

- General Physics and secondary physics teaching contexts
- Mathematical Methods for Physics
- Theoretical Mechanics
- Electrodynamics
- Quantum Mechanics
- Thermodynamics and Statistical Physics

The knowledge map can be extended through the static data files under `src/data`.

## Bilingual Reference Strategy

Physics Learning Agent keeps the interface in English while adapting the answer and exercise style to the user’s language.

For Chinese questions, the agent favors Chinese undergraduate physics conventions, including Chinese textbook terminology, after-chapter exercise style, university final-exam style, and postgraduate-entrance-exam style. The reference traditions include commonly used Chinese course structures such as Liang Kunmiao-style mathematical methods, Zhou Yanbai-style theoretical mechanics, Guo Shuohong-style electrodynamics, Zeng Jinyan and Zhou Shixun-style quantum mechanics, and Wang Zhicheng-style thermodynamics and statistical physics.

For English questions, the agent favors English textbook and open-course conventions. The reference profile includes standard traditions such as Arfken, Boas, Riley-Hobson-Bence, Goldstein, Taylor, Griffiths, Jackson, Sakurai, Shankar, Schroeder, Reif, Pathria, Callen, Kardar, and similar undergraduate or graduate course problem-set styles.

These references are used only as style and curriculum guidance. The project does not include textbook content or official problem statements.

## Practice Problem Generation

Practice Problems is the main structured workflow. It supports:

- automatic language detection
- natural-language course and topic inference
- selectable problem style:
  - Auto
  - Chinese textbook exercises
  - Chinese final exam
  - Chinese postgraduate entrance exam
  - English textbook exercises
  - Open-course problem set
- difficulty and problem-count controls
- output modes for questions-only, hints, full solutions, or hidden answers
- folded cards for each generated problem
- “Ask about this problem” context transfer into chat

Generated problems are original variants. They may follow a source style, but they must not copy textbook, exam, MIT OCW, or other open-course problem statements, and they must not claim to be official source material.

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

Conversation history, answer-depth preference, and lightweight personalization data are stored in the current browser’s `localStorage`. There is no account system or remote user database in the current version.

## RAG Prototype

The lightweight RAG prototype lives in `src/rag`. It uses local Markdown files, text chunking, and keyword retrieval to validate the basic flow of local note retrieval, context injection, and source display.

A production-ready RAG layer would typically add user-owned Markdown, PDF, or LaTeX notes, embeddings, and a vector store such as LanceDB, Chroma, pgvector, or Supabase Vector. Copyrighted textbook content should not be committed to the public repository.

## Source-Style and Copyright Notes

Generated explanations and practice problems are intended for learning support. They should be checked against textbooks, lecture notes, and instructor requirements for formal coursework.

The project may ask the model to follow broad source styles such as “Chinese textbook exercise style” or “open-course problem-set style,” but it should not reproduce protected source text, copy official problems, claim textbook page numbers, or present generated problems as MIT OCW or textbook originals.

## License

MIT
