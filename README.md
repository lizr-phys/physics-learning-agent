# Physics Learning Agent

<p align="center">
  <strong>A minimal, extensible learning workspace for undergraduate physics.</strong>
</p>

<p align="center">
  <a href="#overview">Overview</a> |
  <a href="#features">Features</a> |
  <a href="#learning-workflows">Workflows</a> |
  <a href="#architecture">Architecture</a> |
  <a href="#personal-knowledge-base">Knowledge Base</a> |
  <a href="#getting-started">Getting Started</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=flat-square">
  <img alt="LangChain" src="https://img.shields.io/badge/LangChain-document_retrieval-black?style=flat-square">
  <img alt="LaTeX" src="https://img.shields.io/badge/LaTeX-KaTeX-black?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-black?style=flat-square">
</p>

Physics Learning Agent is a chat-style study workspace for undergraduate physics. It combines conversational tutoring, structured course knowledge, original practice problem generation, personal document retrieval, and multi-provider model access in a restrained interface designed for long reading sessions.

The project is built around two primary workflows:

1. Learn through conversation: ask conceptual questions, follow derivations, debug mistakes, and continue from previous context.
2. Train through problems: generate original practice sets with hidden hints, solutions, answers, and LaTeX export.

It is not a generic chatbot wrapper. The application adds a learning layer around model calls: intent classification, course-aware prompting, language-aware reference profiles, LangChain-based document chunking, retrieval from user-owned materials, account-scoped workspace memory, and strict streaming isolation between sessions.

## Overview

```mermaid
flowchart LR
  Student["Student"] --> Workspace["Chat-style workspace"]
  Workspace --> Chat["Physics chat"]
  Workspace --> Practice["Practice problems"]
  Workspace --> Map["Knowledge map"]
  Workspace --> KB["Personal knowledge base"]
  Workspace --> DataSync["Workspace data sync"]
  Workspace --> Settings["Model settings"]

  Chat --> Agent["Learning agent layer"]
  Practice --> Agent
  Map --> Agent
  KB --> Retriever["Local retriever"]
  Retriever --> Agent
  Settings --> Router["Provider router"]
  Router --> Models["OpenAI / DeepSeek / Qwen / Kimi / GLM / Claude / Gemini / Custom"]
```

| Area | What it provides |
| --- | --- |
| Chat workspace | Long-form physics tutoring, follow-up questions, context memory, streaming answers |
| Practice Problems | Original problem sets with difficulty, style, language, hidden answers, and `.tex` export |
| Knowledge Map | Course topics, prerequisites, related topics, formulas, typical problems, and pitfalls |
| Personal Knowledge Base | User-owned notes and materials indexed for local retrieval |
| Workspace Persistence | Conversations, active session, practice history, learning memory, and safe preferences saved per signed-in user |
| Model Providers | Server-side default model plus browser-side user keys for multiple providers |
| Rendering | Markdown, LaTeX, tables, code blocks, and long formulas with overflow protection |

## Features

### Study-first chat

- ChatGPT-style conversation layout with a persistent input area and scrollable message history
- Session history stored locally in the browser and synced to the signed-in account workspace
- Request isolation across conversations so stale streaming output cannot leak into another session
- Answer depth preferences: concise, standard, detailed, derivation-first, or problem-type-first
- Normal handling of non-physics questions, with a light final note that the workspace is optimized for physics learning
- Account-scoped persistence for conversations, active session, learning memory, and safe model preferences

### Physics-aware answer generation

- Intent classification before prompt construction
- Course-aware response instructions for:
  - mathematical methods for physics
  - theoretical mechanics
  - electrodynamics
  - quantum mechanics
  - thermodynamics and statistical physics
  - general physics and physics education
- Bilingual response behavior:
  - Chinese questions receive Chinese answers and Chinese-course reference style
  - English questions receive English answers and English-textbook reference style
  - explicit user language requests take priority

### Practice problem generation

- Automatic language and topic inference from natural-language requests
- Source-style control:
  - Auto
  - Chinese textbook exercises
  - Chinese final exam
  - Chinese postgraduate entrance exam
  - English textbook exercises
  - Open-course problem set
- Difficulty and count controls
- Output modes:
  - questions only
  - questions with hints
  - full solutions
  - hints with answers hidden by default
- Per-problem folded cards for hints, solutions, and final answers
- One-click follow-up from a generated problem into chat with context attached
- Export generated problem sets as editable LaTeX source

### Personal knowledge base

- Local account flow for small-group or personal deployments
- Upload user-owned notes, problem sets, handouts, or course materials
- LangChain document splitters for Markdown, LaTeX, and plain text indexing
- Markdown, text, TeX, and CSV extraction for retrieval
- PDF, DOCX, and PPTX files are stored as source documents and can be extended with richer parsers later
- Retrieval snippets are injected into the answer context when relevant
- No vector database is required for the current implementation

### Workspace data persistence

- Signed-in users get a server-side workspace snapshot under `PLA_DATA_DIR`
- Persisted data includes chat conversations, active conversation, learning memory, answer-depth preference, onboarding state, non-secret provider preferences, and generated practice history
- Browser storage remains available for anonymous use and is merged into the account snapshot after sign-in
- Provider API keys are intentionally excluded from persistent workspace data

### Bring Your Own Key model access

- Use the server-configured default model, or provide a temporary browser-side key for another provider
- Supported provider routes:
  - OpenAI-compatible APIs
  - DeepSeek
  - Qwen
  - Kimi
  - GLM
  - OpenRouter
  - Anthropic Claude
  - Google Gemini
  - custom compatible endpoint
- User-provided API keys are kept in `sessionStorage`; they are not written to project files or local persistent storage by default

## Learning Workflows

### Conversation workflow

```mermaid
sequenceDiagram
  participant U as Student
  participant UI as Chat UI
  participant A as Agent Layer
  participant R as Retriever
  participant M as Model Provider

  U->>UI: Ask a question
  UI->>A: Send message, session id, preferences
  A->>A: Classify intent and language
  A->>A: Build course and memory context
  A->>R: Retrieve local snippets when available
  R-->>A: Relevant notes
  A->>M: Stream model request
  M-->>UI: Token stream
  UI->>UI: Append only to the bound session and message
```

### Practice workflow

```mermaid
flowchart TD
  Request["Natural-language request"] --> Parse["Infer course, topic, language, style"]
  Parse --> Prompt["Build practice-generation prompt"]
  Prompt --> Model["Generate original problems"]
  Model --> Cards["Render folded problem cards"]
  Cards --> FollowUp["Continue a problem in chat"]
  Cards --> Export["Export to LaTeX"]
```

## Course Coverage

| Course | Representative topics |
| --- | --- |
| General Physics and Physics Education | mechanics foundations, waves, electromagnetism, optics, thermodynamics, teaching-oriented explanations |
| Mathematical Methods for Physics | complex variables, Fourier analysis, integral transforms, PDEs, Green's functions, Sturm-Liouville theory, special functions |
| Theoretical Mechanics | generalized coordinates, constraints, Lagrange equations, Hamiltonian mechanics, canonical transformations, small oscillations |
| Electrodynamics | electrostatic boundary-value problems, image method, multipole expansion, Maxwell equations, waves, potentials, gauge transformations |
| Quantum Mechanics | wave functions, operators, representations, one-dimensional systems, harmonic oscillator, angular momentum, perturbation theory, scattering basics |
| Thermodynamics and Statistical Physics | thermodynamic potentials, Maxwell relations, ensembles, partition functions, quantum statistics, fluctuations, phase equilibrium |

## Reference Strategy

Physics Learning Agent uses reference profiles to adapt wording and problem style without copying protected source material.

| User context | Reference profile | Output style |
| --- | --- | --- |
| Chinese questions | Chinese undergraduate physics curriculum, final exams, postgraduate entrance exam conventions | Chinese classroom terminology, complete conditions, standard derivations, original exercise variants |
| English questions | English textbook conventions and open-course problem-set style | Academic English, textbook-style assumptions, original problem sets, clear solution structure |
| Mixed-language context | Most recent explicit user language and task intent | Preserve the active learning context unless the user changes it |

Generated problems are original. The project does not copy textbook exercises, examination questions, or MIT OpenCourseWare problem statements, and it does not claim generated content is official course material.

## Architecture

```mermaid
flowchart TB
  subgraph Client["Client"]
    Pages["Next.js App Router pages"]
    Components["React components"]
    LocalState["localStorage and sessionStorage"]
  end

  subgraph Server["Server routes"]
    ChatAPI["/api/chat"]
    ProviderAPI["provider adapters"]
    KBAPI["knowledge-base APIs"]
    AuthAPI["local account APIs"]
    UserDataAPI["workspace data API"]
  end

  subgraph Agent["Agent modules"]
    Classifier["intent and language classifier"]
    PromptBuilder["prompt builder"]
    Memory["context and learning memory"]
    LC["LangChain document splitters"]
    PostProcess["post-processing and safety rules"]
  end

  subgraph Data["Local data"]
    Courses["course and topic data"]
    Sessions["conversation sessions"]
    WorkspaceData["workspace snapshots"]
    Docs["uploaded documents"]
    Chunks["retrieval chunks"]
  end

  Pages --> Components
  Components --> LocalState
  Components --> ChatAPI
  ChatAPI --> Agent
  Agent --> ProviderAPI
  Agent --> Data
  Agent --> LC
  KBAPI --> Docs
  KBAPI --> Chunks
  AuthAPI --> Sessions
  UserDataAPI --> WorkspaceData
```

### Key directories

| Path | Purpose |
| --- | --- |
| `src/app` | App Router pages and API routes |
| `src/components` | Chat, layout, practice, knowledge map, settings, and shared UI components |
| `src/data` | Course metadata, knowledge topics, recommendations, and prompt-related data |
| `src/lib` | Provider clients, prompt builder, session storage, user-data sync, personal knowledge indexing, recommendations, and utilities |
| `src/types` | Shared TypeScript types |
| `src/rag` | LangChain-backed chunking, lightweight retrieval utilities, and sample notes |

## Personal Knowledge Base

```mermaid
flowchart LR
  Upload["Upload document"] --> Store["Store source file"]
  Store --> Extract["Extract text when supported"]
  Extract --> LangChain["LangChain splitter"]
  LangChain --> Chunk["Searchable chunks"]
  Chunk --> Search["Keyword retrieval"]
  Search --> Context["Inject relevant snippets into prompt"]
  Context --> Answer["Grounded answer"]
```

The current knowledge base is intentionally lightweight. It uses LangChain for document abstraction and splitting, then applies local keyword retrieval over generated chunks. It is suitable for personal notes, course summaries, handouts, problem sets, and self-authored explanations. A production-grade retrieval stack can later add LangChain loaders, embeddings, vector indexes, reranking, and citation-aware answer generation.

## Model Providers

| Provider path | Notes |
| --- | --- |
| Server default | Uses environment variables and keeps the API key server-side |
| OpenAI-compatible | Works with OpenAI-style `/chat/completions` providers |
| Anthropic Claude | Uses the Claude messages API |
| Google Gemini | Uses the Gemini generation API |
| Custom endpoint | For compatible local or hosted model gateways |

The application separates provider configuration from the learning workflow. This makes it possible to keep a default model for deployment while allowing advanced users to test their own providers from the settings page.

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm
- A model provider key, such as DeepSeek, OpenAI, Qwen, Claude, Gemini, or another compatible provider

### Install

```bash
npm install
```

### Configure environment variables

Create `.env.local`:

```txt
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

The server-side DeepSeek configuration is optional if users only rely on browser-provided keys in the settings page, but a server-side default is recommended for a smoother local setup.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server |
| `npm run lint` | Run lint checks |
| `npm run test:run` | Run the test suite, if configured in the current checkout |

## Security and Privacy

- Server-side provider keys are read from environment variables and are never exposed to client code.
- Browser-entered provider keys are kept in `sessionStorage` for the active browser session.
- Anonymous conversation history and study state are stored in the browser.
- Signed-in workspace data is saved under `PLA_DATA_DIR`, including conversations, practice history, learning memory, and safe preferences.
- API keys entered through Bring Your Own Key mode are not written to the account workspace snapshot.
- The personal knowledge base is designed for user-owned learning materials.
- Do not upload copyrighted textbooks or private course materials to a public deployment unless you have the right to do so.
- The built-in local account system is intended for personal or small-group deployments, not as a hardened enterprise identity system.

## Roadmap

- Richer document extraction for PDF, DOCX, and PPTX
- Embedding-based retrieval with a pluggable vector store
- Citation-aware answers for user-owned notes
- Better export formats for practice sets and study records
- Optional teacher mode for classroom problem-set preparation
- More structured test coverage for streaming, retrieval, and provider adapters

## Copyright and Source-style Notes

The project can generate exercises in the style of common textbook or open-course problem sets, but generated problems should be treated as original variants. It should not be used to copy protected problem statements, reproduce textbook content, or imply official affiliation with any textbook, university, or course.

## License

MIT
