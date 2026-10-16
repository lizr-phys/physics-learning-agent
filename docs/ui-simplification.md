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

## Typography, alignment and feedback — 2026-10-16

The screenshot review identified two rendered defects that the static detector did not flag: an unlayered `font: inherit` overrode utility font sizes, and the attachment picker used a different row height with trailing hidden-input spacing. Four desktop/mobile regression cases failed before changes: button centers differed by 6 px without an image and by 46 px on mobile after attaching one; Image used 12 px while Options used 16 px. Geist was loaded but the body still selected the system face.

The existing Geist family now supplies interface and reading type with local Chinese fallbacks; no additional family or animation dependency is installed. Body/answer/input text uses 16 px, controls use 14 px, supporting metadata uses 13 px, and headings retain the established semibold hierarchy. Form inheritance lives in the base cascade layer so role-specific styles can work. Coarse-pointer form fields retain a 16 px floor. User text scaling and browser zoom remain available.

The composer gives image, camera, options and send controls one shared 44 px row. Image previews and privacy/error text sit above or below that row, rather than changing its alignment. Narrow containers retain the Options icon with its accessible name. Navigation labels, history indentation, thin history scrollbars and the empty-answer avatar row use consistent alignment. Mobile branding can truncate when text is enlarged.

Feedback uses 120 ms control transitions, a 140 ms popover reveal and a 180 ms mobile drawer reveal. No page-load sequences, animation timers, per-token effects or animation libraries are introduced. Nonessential motion follows the reduced-motion preference; keyboard focus and existing cancellation remain immediate.

Changed implementation: `globals.css`, `layout.tsx`, `ChatInput.tsx`, `ChatWorkspace.tsx`, `ChatMessage.tsx`, `ImageAttachments.tsx`, `Popover.tsx`, `Sidebar.tsx`, `AppShell.tsx`. New regressions are in `e2e/typography-and-motion.spec.ts`; they cover font roles, bilingual reading, same-origin font delivery, row alignment with images, reduced motion, keyboard dismissal and enlarged text at 320–1280 px.

Acceptance for this follow-up:

- `npm run lint`: passed after the final browser harness edit.
- `npm run test:run`: 52 files / 477 tests passed (37.78 s).
- `npm run test:quality`: 158 tests passed (3.05 s), included in the 477 total.
- `npm run build`: passed on Next.js 16.3.8, including TypeScript and all 20 page-generation entries, after the final style changes.
- `npm audit --omit=dev --json`: 0 findings, exit 0 on October 16. No dependency versions changed; the earlier full-tree development exception is recorded separately in the dependency review.
- `npm run test:e2e`: 80 passed (4.6 min), desktop/mobile Chromium. The eight new cases also passed independently (32.9 s).

An earlier complete browser run returned 74 passed / 6 failed because the development server served stale generated CSS: production output already contained Geist, motion and container rules, while the served development stylesheet did not. With the server stopped, only the generated `.next/dev` directory was moved into an ignored `.next/cache/pla-ui-dev-backup-*` directory. Fresh development output passed all eight targeted cases and the complete 80-case suite; application assertions were retained. A separate text-scaling fixture was corrected to insert a style tag after the input appeared, avoiding a test-induced hydration mismatch.

One combined screenshot inspection covered all five pages on desktop/mobile, bilingual reading, attached-image controls, enlarged text, chat options, document upload, BYOK settings, long formulas and a table. The accepted images showed consistent control centers, readable type and no document-wide horizontal overflow. No further visual edits were needed. The README workspace image now comes from this accepted desktop run; the original logo remains untouched.

The [Chinese deployment walkthrough](deployment.zh-CN.md) describes the existing single-host stack. `deploy/Caddyfile` now relies on Caddy's immediate SSE flushing instead of a negative `flush_interval`, preserving its documented propagation of client disconnects. Actual proxy cancellation, container startup, real-model behavior, physical mobile keyboards and human physics review remain untested locally. No live deployment or paid model call was performed.

The local preview was restarted at `http://127.0.0.1:3218/chat`, reusing the earlier isolated preview data directory rather than replacing its records. Health and all five pages returned HTTP 200. Its status-only provider check confirmed that the server key is absent; use API Settings with a test key for interactive generation. Original application data and `.env.local` were not changed.
