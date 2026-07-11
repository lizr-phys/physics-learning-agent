<p align="center">
  <img src="public/logo.png" alt="Physics Learning Agent logo" width="120" />
</p>

<h1 align="center">Physics Learning Agent</h1>

<p align="center">
  <strong>A LangGraph-orchestrated learning workspace for undergraduate physics.</strong>
</p>

<p align="center">
  <a href="#overview">Overview</a> |
  <a href="#features">Features</a> |
  <a href="#learning-workflows">Workflows</a> |
  <a href="#architecture">Architecture</a> |
  <a href="#personal-knowledge-base">Knowledge Base</a> |
  <a href="#getting-started">Getting Started</a> |
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=flat-square">
  <img alt="LangChain" src="https://img.shields.io/badge/LangChain-document_retrieval-black?style=flat-square">
  <img alt="LangGraph" src="https://img.shields.io/badge/LangGraph-agent_workflow-black?style=flat-square">
  <img alt="LaTeX" src="https://img.shields.io/badge/LaTeX-KaTeX-black?style=flat-square">
  <a href="https://github.com/lizr-phys/physics-learning-agent/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/lizr-phys/physics-learning-agent/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-black?style=flat-square"></a>
</p>

<p align="center">
  <img src="docs/assets/workspace.png" alt="Physics Learning Agent conversation workspace" width="1100" />
</p>

Physics Learning Agent is a chat-style study workspace for undergraduate physics. It combines conversational tutoring, structured course knowledge, original practice problem generation, personal document retrieval, and multi-provider model access in a restrained interface designed for long reading sessions.

The project is built around two primary workflows:

1. Learn through conversation: ask conceptual questions, follow derivations, debug mistakes, and continue from previous context.
2. Train through problems: generate original practice sets with hidden hints, solutions, answers, and LaTeX export.

It is not a generic chatbot wrapper. The application adds a learning layer around model calls: a LangGraph-orchestrated workflow, intent classification, course-aware prompting, language-aware reference profiles, LangChain-based document chunking, retrieval from user-owned materials, account-scoped workspace memory, and strict streaming isolation between sessions.

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

  Chat --> Agent["LangGraph agent workflow"]
  Practice --> Agent
  Map --> Agent
  KB --> Retriever["Structured document retrieval"]
  Retriever --> Agent
  Settings --> Router["Provider router"]
  Router --> Models["OpenAI / DeepSeek / Qwen / Kimi / GLM / Claude / Gemini / Custom"]
```

| Area | What it provides |
| --- | --- |
| Chat workspace | Long-form physics tutoring, follow-up questions, context memory, streaming answers, and answer feedback |
| Practice Problems | Original problem sets with difficulty, style, language, hidden answers, self-assessment, and `.tex` export |
| Knowledge Map | Course topics, prerequisites, related topics, formulas, typical problems, and pitfalls |
| Personal Knowledge Base | User-owned notes and course materials parsed into metadata-rich, citation-ready chunks |
| Agent Workflow | LangGraph nodes for input understanding, context resolution, memory update, retrieval planning, retrieval execution, and generation preparation |
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
- Personal knowledge modes for chat: automatic retrieval, always-on retrieval, or retrieval disabled
- A compact useful / needs-improvement signal attached to each completed answer

### Physics-aware answer generation

- LangGraph workflow before generation:
  - input understanding
  - course and topic context resolution
  - learning-memory update
  - personal-knowledge retrieval planning
  - retrieval execution
  - prompt-ready request preparation
- Robust intent routing for conceptual questions, review requests, study planning, practice generation, and non-physics input
- Course-aware response instructions for:
  - general physics
  - mathematical methods for physics
  - theoretical mechanics
  - electrodynamics
  - quantum mechanics
  - thermodynamics and statistical physics
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
- Per-problem `Solved` and `Needs work` self-assessment stored with the generated set
- One-click follow-up from a generated problem into chat with context attached
- Export generated problem sets as editable LaTeX source

### Personal knowledge base

- Local account flow for small-group or personal deployments
- Upload user-owned notes, problem sets, handouts, or course materials
- LangChain document splitters for Markdown, LaTeX, and plain text indexing
- Structured extraction for text-based PDF, DOCX, PPTX, XLSX, RTF, and OpenDocument files
- Course and topic metadata for context-aware retrieval
- BM25, phrase, heading, and metadata score fusion with duplicate suppression
- Page, slide, sheet, and section locators when the source format exposes them
- Reindexing for existing files as the retrieval pipeline evolves
- Chat can use the personal library in three modes:
  - `Auto`: retrieve only when the message clearly refers to uploaded materials or follows up on personal-library context
  - `Always`: retrieve from the signed-in user's personal library on every turn
  - `Off`: answer without personal-library retrieval
- Retrieval snippets are injected into the answer context only for the signed-in user who owns the documents
- Retrieved claims use citation-aware prompt instructions and supplied source locators
- No vector database is required for local development; the scorer accepts optional dense-vector scores for a future pgvector backend

### Workspace data persistence

- Signed-in users get a server-side workspace snapshot under `PLA_DATA_DIR`
- Persisted data includes chat conversations, answer feedback, active conversation, learning memory, answer-depth preference, onboarding state, non-secret provider preferences, generated practice history, and per-problem self-assessment
- Browser storage remains available for anonymous use and is merged into the account snapshot after sign-in
- Provider API keys are intentionally excluded from persistent workspace data

### Pilot quality loop

- Completed answers can be marked as useful or needing improvement, with optional issue categories for clarity, formulas, or sources
- Generated problems can be marked as solved or needing more work without exposing the answer by default
- Anonymous feedback remains in browser storage; signed-in feedback follows the existing account-scoped workspace snapshot
- A deterministic offline baseline checks intent routing, course resolution, and bundled-note retrieval without spending model tokens
- Evaluation fixtures are designed to grow from anonymized pilot failure patterns rather than one-off prompt tuning

The project does not send these learning signals directly to a model provider and does not include hidden analytics collection. A production pilot can aggregate consented, anonymized signals in a separate analytics pipeline later.

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
  participant A as LangGraph Workflow
  participant R as Retriever
  participant M as Model Provider

  U->>UI: Ask a question
  UI->>A: Send message, session id, preferences
  A->>A: Understand input and language
  A->>A: Resolve course, topic, style, and memory
  A->>A: Plan whether retrieval is needed
  A->>R: Retrieve local snippets when available
  R-->>A: Relevant notes
  A->>A: Prepare model request
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
| General Physics | units and vectors, Newtonian mechanics, circular motion, gravitation, fluids, oscillations and waves, thermal physics, electromagnetism, circuits, geometrical optics, modern physics, measurement, uncertainty |
| Mathematical Methods for Physics | vector analysis, curvilinear coordinates, complex variables, Fourier analysis, integral transforms, distributions, PDEs, boundary-value problems, Sturm-Liouville theory, Green's functions, special functions, asymptotic methods |
| Theoretical Mechanics | particle systems, central forces, rigid-body kinematics and dynamics, non-inertial frames, constraints, virtual work, Lagrange equations, Hamilton's principle, canonical equations, Poisson brackets, canonical transformations, Hamilton-Jacobi theory, small oscillations |
| Electrodynamics | electrostatics, magnetostatics, fields in matter, boundary-value problems, image method, multipole expansion, Maxwell equations, electromagnetic boundary conditions, waves, waveguides, potentials, gauge transformations, radiation, relativistic electrodynamics |
| Quantum Mechanics | wave functions, state vectors, Hilbert space, Dirac notation, postulates, operators, representations, one-dimensional systems, harmonic oscillator, central-force problems, angular momentum, spin, identical particles, perturbation theory, WKB, scattering basics, density matrices |
| Thermodynamics and Statistical Physics | equilibrium, thermodynamic laws, state functions, thermodynamic potentials, Maxwell relations, chemical potential, phase equilibrium, ensembles, partition functions, classical statistics, quantum statistics, Bose condensation, degenerate Fermi gas, fluctuations, critical phenomena |

## Reference Strategy

Physics Learning Agent uses reference profiles to adapt wording and problem style without copying protected source material.

| User context | Reference profile | Output style |
| --- | --- | --- |
| Chinese questions | Chinese undergraduate physics curriculum, final exams, postgraduate entrance exam conventions | Chinese undergraduate-course terminology, complete conditions, standard derivations, original exercise variants |
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
    Graph["LangGraph workflow"]
    Classifier["intent and language classifier"]
    Context["course and topic context manager"]
    Memory["learning memory"]
    RetrievalPlan["retrieval planner"]
    LC["LangChain document splitters"]
    Parser["Structured document parser"]
    Search["Hybrid lexical retriever"]
    PromptBuilder["prompt builder"]
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
  ChatAPI --> Graph
  Graph --> Classifier
  Graph --> Context
  Graph --> Memory
  Graph --> RetrievalPlan
  RetrievalPlan --> Data
  Graph --> PromptBuilder
  PromptBuilder --> ProviderAPI
  Graph --> Data
  KBAPI --> Docs
  KBAPI --> LC
  KBAPI --> Parser
  LC --> Chunks
  Parser --> Chunks
  Chunks --> Search
  AuthAPI --> Sessions
  UserDataAPI --> WorkspaceData
```

### Key directories

| Path | Purpose |
| --- | --- |
| `src/app` | App Router pages and API routes |
| `src/components` | Chat, layout, practice, knowledge map, settings, and shared UI components |
| `src/agent` | LangGraph workflow, intent classification, memory, retrieval decisions, model config, and response post-processing |
| `src/data` | Course metadata, knowledge topics, recommendations, and prompt-related data |
| `src/lib` | Provider clients, prompt builder, session storage, user-data sync, personal knowledge indexing, recommendations, and utilities |
| `src/types` | Shared TypeScript types |
| `src/rag` | Document extraction, LangChain-backed chunking, hybrid retrieval, evaluation, and sample notes |

For a detailed request lifecycle, state model, retrieval design, and deployment boundary, see [Architecture](docs/architecture.md). A printable LaTeX version is available in [project-architecture.tex](docs/project-architecture.tex).

## Personal Knowledge Base

```mermaid
flowchart LR
  Upload["Upload document"] --> Store["Store source file"]
  Store --> Extract["Format-aware extraction"]
  Extract --> Chunk["Metadata-rich chunks"]
  Chunk --> Search["BM25 + phrase + metadata retrieval"]
  Search --> Rerank["Diversity selection"]
  Rerank --> Context["Citation-aware prompt context"]
  Context --> Answer["Grounded answer"]
```

The personal knowledge base is designed for notes, lecture slides, problem sets, course handouts, and self-authored explanations. Text formats use LangChain splitters; office and PDF formats use structure-aware extraction that preserves available page, slide, sheet, and heading metadata. Retrieval combines bilingual tokenization, BM25, phrase and heading relevance, course/topic context, and duplicate suppression before snippets enter the LangGraph workflow.

The local store is intended for development and small private tests. A mainland production deployment can move users, conversations, document metadata, and chunks to TencentDB for PostgreSQL, add `pgvector` HNSW retrieval through the existing vector-score fusion interface, place original files in Tencent Cloud COS, and run ingestion jobs through Redis-backed workers.

## Model Providers

| Provider path | Notes |
| --- | --- |
| Server default | Uses environment variables and keeps the API key server-side |
| OpenAI-compatible | Works with OpenAI-style `/chat/completions` providers |
| Anthropic Claude | Uses the Claude messages API |
| Google Gemini | Uses the Gemini generation API |
| Custom endpoint | For compatible hosted gateways, or explicitly trusted private endpoints in self-hosted environments |

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
DEEPSEEK_THINKING=disabled
DEEPSEEK_TIMEOUT_MS=120000
PLA_DATA_DIR=.pla-data
PLA_ALLOW_PRIVATE_MODEL_ENDPOINTS=false
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
| `npm run test:run` | Run the unit and module integration tests |
| `npm run test:quality` | Run the offline pilot-quality baseline for routing, course resolution, and retrieval |
| `npm run test:e2e` | Run Playwright browser tests on desktop and mobile viewports |
| `npm run test:all` | Run lint, unit tests, production build, and browser tests |

## Security and Privacy

- Server-side provider keys are read from environment variables and are never exposed to client code.
- Browser-entered provider keys are kept in `sessionStorage` for the active browser session.
- Anonymous conversation history and study state are stored in the browser.
- Signed-in workspace data is saved under `PLA_DATA_DIR`, including conversations, practice history, learning memory, and safe preferences.
- API keys entered through Bring Your Own Key mode are not written to the account workspace snapshot.
- Custom provider URLs are validated server-side; production mode blocks private, loopback, link-local, metadata, and reserved network destinations by default.
- Authentication and generation endpoints use bounded request bodies and lightweight in-process rate limits.
- The personal knowledge base is designed for user-owned learning materials.
- Do not upload copyrighted textbooks or private course materials to a public deployment unless you have the right to do so.
- The built-in local account system is intended for personal or small-group deployments, not as a hardened enterprise identity system.

## Deployment Boundary

The included persistence layer is designed for local development and small, single-process private deployments. It uses atomic JSON writes, keyed in-process locks, local uploads, and an in-memory rate limiter. These choices keep setup simple and make the full workflow inspectable, but they are not a substitute for shared production infrastructure.

For a multi-instance deployment, replace the local stores with a transactional database, object storage, shared sessions and rate limits, and background document-ingestion workers. The existing interfaces are structured so PostgreSQL, `pgvector`, COS/S3-compatible storage, and Redis-backed jobs can be introduced without changing the learning workflow or UI contracts.

## Roadmap

- TencentDB for PostgreSQL and COS persistence adapters
- Embedding-based retrieval through pgvector with bilingual reranking
- OCR for scanned Chinese and English course materials
- Retrieval diagnostics and user-visible citation inspection
- Better export formats for practice sets and study records
- Structured problem-set authoring tools for instructors and study groups
- Larger retrieval and answer-grounding evaluation sets

## Copyright and Source-style Notes

The project can generate exercises in the style of common textbook or open-course problem sets, but generated problems should be treated as original variants. It should not be used to copy protected problem statements, reproduce textbook content, or imply official affiliation with any textbook, university, or course.

## License

Released under the [MIT License](LICENSE).
