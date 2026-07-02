# Physics Learning Agent

Physics Learning Agent is a focused learning workspace for undergraduate physics. It combines a chat-style interface, structured course knowledge, original practice problem generation, Markdown and LaTeX rendering, and server-side DeepSeek integration.

The project is built for students who want a quiet place to ask physics questions, review course topics, check derivations, and practice problem solving across the standard undergraduate physics curriculum.

## Features

- Chat-style learning workspace for physics questions and derivations
- Bilingual tutoring for Chinese and English questions
- Knowledge map for core undergraduate physics courses
- Original practice problem generation with style, difficulty, count, and output controls
- Folded practice problem cards with hints, solutions, and answers hidden by default
- Markdown, LaTeX, table, and code rendering
- Streaming model responses through server-side API routes
- Local conversation history and lightweight learning memory
- Answer depth control for concise answers, standard explanations, detailed derivations, and problem-solving oriented responses
- Local Markdown-based RAG prototype for future note retrieval workflows

## Course Coverage

Physics Learning Agent is organized around the main undergraduate physics sequence:

- General Physics and physics education contexts
- Mathematical Methods for Physics
- Theoretical Mechanics
- Electrodynamics
- Quantum Mechanics
- Thermodynamics and Statistical Physics

The knowledge map and course metadata live in `src/data` and can be extended without changing the application architecture.

## Bilingual Learning Strategy

The interface is English, while answers follow the language and intent of the user's input.

For Chinese questions, the agent follows common Chinese undergraduate physics conventions, including textbook terminology, after-chapter exercise style, university final-exam style, and postgraduate-entrance-exam style. The reference traditions include widely used Chinese course structures for mathematical methods, theoretical mechanics, electrodynamics, quantum mechanics, and thermodynamics and statistical physics.

For English questions, the agent follows English textbook and open-course conventions. The reference profile is aligned with standard undergraduate and graduate physics traditions such as Arfken, Boas, Goldstein, Taylor, Griffiths, Jackson, Sakurai, Shankar, Schroeder, Reif, Pathria, Callen, Kardar, and related course problem-set styles.

These references are used as curriculum and style guidance only. The project does not include textbook content, official exam questions, or official open-course problem statements.

## Practice Problems

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
- output modes for questions only, hints, full solutions, or hidden answers
- folded cards for each generated problem
- context transfer from a generated problem into chat

Generated problems are original variants. They may follow a broad source style, but they should not copy textbook, exam, MIT OpenCourseWare, or other open-course problem statements, and they should not be presented as official source material.

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

Conversation history, answer-depth preferences, and lightweight learning memory are stored in the current browser's `localStorage`. There is no account system or remote user database.

## RAG Prototype

The RAG prototype lives in `src/rag`. It uses local Markdown files, text chunking, and keyword retrieval to validate the basic flow of local note retrieval, context injection, and source display.

A production RAG layer can add user-owned Markdown, PDF, or LaTeX notes, embeddings, and a vector store such as LanceDB, Chroma, pgvector, or Supabase Vector. Copyrighted textbook content should not be committed to the public repository.

## Source-Style and Copyright Notes

Generated explanations and practice problems are intended for learning support. For formal coursework, results should be checked against textbooks, lecture notes, and instructor requirements.

The project may ask the model to follow broad source styles such as "Chinese textbook exercise style" or "open-course problem-set style." It should not reproduce protected source text, copy official problems, claim textbook page numbers, or present generated problems as MIT OpenCourseWare or textbook originals.

## License

MIT
