# Interface simplification

Date: 2026-10-15. Scope: reduce competing controls in the existing English learning workspace, preserving its visual identity and all learning/data functions.

## Decisions

| Surface | Primary task | Change |
| --- | --- | --- |
| Navigation | Choose a workspace | Chat, Practice, Map and Personal Knowledge remain primary. API Settings moves to the footer. Conversation history and New conversation appear only in Chat. |
| Chat | Ask or attach a question | One short welcome, optional examples, compact composer. Depth, retrieval mode and material scope share one Options popover. The quick guide moves inside that entry. |
| Practice | Create and read a problem set | One reading column replaces the permanent form/result split. A finished set collapses its request editor; Edit request restores all settings. |
| Knowledge Map | Read a concept | Course/topic selectors replace the second sidebar and long topic list. Definitions and formulas stay prominent; supporting notes remain available. |
| Personal Knowledge | Find and use saved material | Library first. Add material opens a focused panel for photo problems or document uploads. Account information and per-document actions become contextual menus. |
| API Settings | Connect a model | One selected connection source at a time. Only relevant fields are shown; diagnostics, environment setup and data tools move under Advanced. |

No modules, stored records, source images, model choices, export capabilities or permission boundaries are removed. Photo drafts still checkpoint before navigation or cancellation. Keyboard dismissal and focus restoration are required for transient controls.

Save state occupies its own small footer rather than floating over the input or learning text. Detailed sync warnings and explicit import choices can expand that footer. Upload and reindex notices describe whether a material is ready for chat; extraction counts remain available in File details.

## Implementation

| Area | Files |
| --- | --- |
| Shared transient controls | `src/components/common/Popover.tsx`, `SidePanel.tsx` |
| Navigation and save state | `src/components/layout/Sidebar.tsx`, `AppShell.tsx`, `UserDataSync.tsx` |
| Chat entry and options | `src/components/chat/ChatInput.tsx`, `ChatWorkspace.tsx`, `WelcomePrompts.tsx`, `FirstUseGuide.tsx`, `KnowledgeScopeControl.tsx` |
| Learning pages | `src/components/forms/AgentGenerator.tsx`, `src/components/KnowledgeMapExplorer.tsx` |
| Library and capture | `src/app/knowledge-base/page.tsx`, `src/components/knowledge/DocumentUploadForm.tsx`, `PhotoProblemCapture.tsx` |
| Connection and keyboard styles | `src/app/settings/api/page.tsx`, `src/app/globals.css` |
| Browser regressions | `e2e/frontend-focus.spec.ts`, `practice-and-layout.spec.ts`, `photo-library.spec.ts`, `multimodal.spec.ts`, `sources-and-responsive.spec.ts` |

## Acceptance

Tests use isolated data, synthetic accounts and mock model responses. The first complete browser run passed all 72 cases. One batched desktop/mobile inspection covered all five pages, the upload dialog, saved materials, reviewed photo notes and BYOK settings. It identified the overlapping save badge and technical upload notice; these were corrected together. The final 72-case run and one visual confirmation pass also passed. Existing behavior assertions are retained; tests open newly contextual controls before using them.

- Final lint passed.
- Final unit/integration suite: 52 files / 477 tests passed (15.18 s).
- Offline quality: 158 tests passed (2.89 s); included in the 477 count.
- Production dependency audit: 0 findings. The full audit still reports the same five development-only entries in the documented `braces` chain; no dependency versions changed in this refinement.
- Final production build passed on Next.js 16.3.8, including TypeScript and all 20 page-generation entries.
- Final browser suite: 72 passed (4.3 min), desktop and mobile Chromium. Visual confirmation checked the reserved save footer, readable options, material notice, long formulas/tables and recovery control placement. No further visual changes were made after confirmation.

New browser coverage checks contextual history with conversation restoration, draft and composer stability while Options is open, Escape/focus return, document upload and row actions, retained request settings after practice generation, and separate server/BYOK test results. Photo regressions additionally close/reopen the panel before navigating away and verify that source images and edited text remain available without bypassing review.

Successful screenshots are local ignored artifacts under `test-results/` and can be replaced by later runs. Browser emulation does not establish physical keyboard/iOS behavior. No paid model calls, human physics review, user-data migration or deployment are part of these checks.

Local review is available at `http://127.0.0.1:3218/chat` in the running development process. Health and all five pages returned HTTP 200; the status-only provider check confirmed that its server key is absent. The process uses a fresh temporary data directory and a separate browser origin, leaving existing account files, notes, conversations and `.env.local` intact. Supply a test provider through API Settings to try generation. This is a local preview, not a deployment.
