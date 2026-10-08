# Implementation progress

Started: 2026-10-07 (Asia/Shanghai). Baseline: `489b001`.

The existing untracked Chinese plan, product requirements and `logo.png` are preserved. Tests use temporary directories, synthetic accounts and mock providers. No deployment or real-model correctness claim is part of this run.

The subsequent image-input and compact-interface implementation, verification and limits are tracked in [multimodal-ui-progress.md](multimodal-ui-progress.md). Its final test ledger supersedes the earlier local acceptance counts below while retaining this stage history. GitHub upload was explicitly authorized by the user on 2026-10-08; it does not authorize deployment.

| Finding | Status | Scope / evidence | Remaining |
| --- | --- | --- | --- |
| F01 | Implemented; local acceptance passed | Scoped caches, auth epoch, abort/stale guards, explicit imports; desktop/mobile account, tab, delayed GET and draft cases | Actual shared-device pilot observation |
| F02 | Implemented; A gate passed with documented dev exception | Production audit 0; full audit 5 high entries in one unpatched braces development chain; parser/native smoke passed | Maintainer assignment and upstream review by 2026-10-21 |
| F03 | Implemented; local acceptance passed | Revisions, idempotence, tombstones, merge/conflict copies, tab journals, transactional rollback, quota/save states; no idle sync echo | Hardware-crash recovery and multi-instance transactional storage remain outside this implementation |
| F04 | Implemented; local acceptance passed | Typed bound SSE; three-protocol anomaly matrix, cancellation and honest terminal states | Live provider availability and billing checks |
| F05 | Implemented; local acceptance passed | Current language/course/style precedence, word boundaries, 1–20 counts | Real-language pilot observations |
| F06 | Implemented; local acceptance passed | Content-only admission, stable sources, strict source API, scopes, five retrieval states | Authorized real-material labels and human citation-support review |
| F07 | Implemented; local acceptance passed | Math/code boundaries, shared export normalizer, GFM and overflow | Real-device observations |
| F08 | Implemented; local acceptance passed | Single budget, source-tagged assistant evidence, final-only memory commit | Long real-model learning-session review |
| F09 | Implemented; local acceptance passed | Two-problem batches, stable IDs, bounded format repair, validation/final commit, refresh recovery | Physics correctness and representative live-provider practice sets |
| F10 | Implemented; local acceptance passed | composition ref, isComposing/keyCode 229, Shift Enter; desktop/mobile injection checks | Physical IME/iOS review remains external |
| F11 | Implemented; local acceptance passed | 1-second/batch checkpoints, stop/leave flush, single-entity writers, helpers/components, lazy/deferred rendering; save-count and screenshot checks | Real-device performance and larger authorized datasets |
| F12 | Local tools implemented and tested; external trial pending | Synthetic 120-query RAG suite, retained request diagnostics, explicit aggregate export/CLI, blank reviewer CSV, concurrency/token pools | Recruitment, human physics review, live-provider and deployed observations are not performed |

## Verification ledger

Historical 121 unit tests / 24 browser tests are not current evidence. All required commands will be rerun after implementation. Stage-specific regression results are recorded as they become available.

- A, before fixes: two client regressions failed (80 records reduced to 60; deleted session restored). Five new server regressions also failed before server fixes.
- A, after fixes: `npx vitest run src/lib/user-data-client.test.ts src/lib/user-data-server.test.ts src/lib/workspace-sync.test.ts src/app/api/user-data/route.test.ts src/lib/storage.test.ts src/lib/practice-history.test.ts`: **6 files / 29 tests passed**.
- A browser gate: `npm run test:e2e -- e2e/workspace-isolation.spec.ts e2e/user-data.spec.ts --project=desktop-chromium`: **3 passed** (37.8 s), temporary test data directory and mock generation.
- A dependency evidence: see [dependency-audit.md](dependency-audit.md). Production audit exited 0; full audit exited 1 for the documented development exception. No exploit attempt or live model call was performed.

- B rendering before fixes: tagged display normalization and GFM table tests failed. After fixes: renderer/export 10 passed; tagged export regression added to final suite.
- B IME before fix: composition confirmation generated one unintended request. After fix: `npm run test:e2e -- e2e/input-and-math.spec.ts`: 4 passed on desktop/mobile Chromium (16.7 s). Event injection does not certify real IMEs or iOS.
- B context helpers: eight new regressions initially failed. Helper tests now cover language switches, interrupted derivation boundaries and final memory evidence; integration ongoing.

- Continued on 2026-10-08. B full gate before C: `npm run test:run`: 38 files / 211 tests passed. Targeted desktop/mobile isolation, IME and math cases passed (18 scenarios after correcting synthetic-client rate-limit identities).
- C retrieval targeted gate: 8 files / 199 tests, TypeScript and targeted ESLint passed. Includes 120 explicitly synthetic queries on a toy corpus; no human source-support labels or physics review are claimed.
- C source/responsive gate: 4 desktop/mobile cases passed (33.9 s), using actual synthetic uploads and authorized source lookup plus mock answer events. Visual review found the Back to bottom control overlapping the input after adding scope controls; placement now follows measured footer height and will be reverified.
- Additional A adversarial review found offline preference overwrite, empty-profile restore, tombstone/capacity ordering, half-applied quota failure, and cross-tab read/modify/write loss. The first four fixes passed targeted regressions; a bounded per-writer journal is being integrated for the last case. Earlier A gates are not a substitute for the final checks.

- October 8 dependency refresh: new advisory data reflagged Next 16.3.6 (production 1 high / full 6 high). Updated matching Next/ESLint to 16.3.8, without forced audit repair. Fresh audits now confirm production **0 findings / exit 0**, full **5 high / exit 1**, all in the documented development chain.
- C task targeted gate: 7 files / 42 tests passed, including six actual API → preparation graph → task graph → provider adapter scenarios with a mock upstream. The ten-problem interruption/refresh/recovery case passed on desktop/mobile Chromium in the earlier targeted browser run; the final full run remains pending.
- D report regression first failed because practice attempts were omitted and total-only usage was treated as measured output. The fixed report deduplicates chat/practice attempts and exposes the output-usage denominator: 4 tests passed.
- First final unit attempt: 401 passed / 2 timed out while 45 files loaded in parallel. The same two files passed all 5 tests in 2.62 s with two workers. The harness now uses at most four workers; assertions and application deadlines were retained. Full suite will be repeated after journal integration.
- Final offline quality command: `npm run test:quality`: **158 passed**, 3.22 s. Evidence remains deterministic/synthetic, not live-model or human-physics evaluation.
- CI now gates production audit and offline quality, records the full audit, and archives failed browser screenshots/traces. This local change has not been run on GitHub or in Docker.
- Additional capacity UI reproduction: at 80 conversations, submitting a new question threw an unhandled browser rejection. The regression failed before the fix. Chat now preserves the input, presents the quota, and does not call a provider for unsavable initial data; the desktop/mobile regression passed (**2 cases**, 11.5 s). Checkpoint and final save failures also retain on-screen content with a save warning.
- Final C/persistence handoff: **8 files / 86 tests passed**, TypeScript and targeted lint passed. Practice journals write only the changed set, retain cross-tab assessments/attempts, enforce deletion and support scoped anonymous import.
- Final A targeted gate: **4 files / 31 tests passed**, TypeScript and targeted lint passed. Full metadata coverage is required before acknowledging a writer, and conditional cleanup preserves a peer's newer preference operation.
- Multitab idle reproduction failed before the fix: PUT count rose from 6 to 8 with no user edits. A mutation classifier now ignores acknowledgement/revision-only bookkeeping while accepting real writer, preference and tombstone changes. **10 helper tests + 2 desktop/mobile browser cases passed**; no indefinite echo occurred after settling.
- Latest full lint passed; latest unit run **46 files / 427 passed**, 13.05 s. One subsequent journal metadata regression and the new storage-event helper require inclusion in the final frozen-code unit run.
- Synthetic pilot-report CLI passed, including total-only usage kept unmeasured and refusal to overwrite an existing report. No consented real learner export was used.
- Peer-navigation reproduction failed before the fix because another tab cleared the current input. Active selections now use account-scoped tab session storage, and background refresh keeps a selected conversation and its typed draft. The historical test expecting remote selection to navigate the current tab was updated to the intended independent-tab behavior while preserving its remote-data assertions. Further signed-in stability coverage is part of the final browser run.
- Frozen-code gate: `npm run lint` passed; `npm run test:run` **47 files / 444 passed**, 18.04 s; `npm run build` passed with Next.js 16.3.8, TypeScript and all 17 generated pages. Build compilation took 30.5 s; complete browser acceptance is running.
- First complete browser run: **45 passed / 3 failed**. Two formula assertions sampled before lazy rendering completed; the exact minimum-four assertion is retained with retry. The mobile cancellation fixture could finish its 1.2-second tail before navigation; the fixture now gates the late tail until cancellation, then releases it and retains the stale-output assertions. These are harness timing repairs, not lower acceptance thresholds.
- Browser inspection also exposed a reader heuristic falsely treating complete bold text, C++ and slash-ended URLs as partial. Three regressions failed first; the reader now checks actual structure rather than arbitrary trailing prose characters, and ignores math delimiters inside closed code. The four related regressions pass.
- Latest revised-code gate: `npm run lint` passed; `npm run test:run` **47 files / 448 passed**, 28.96 s; `npm run build` passed again (warm compile 6.8 s, TypeScript 13.9 s). The complete browser suite is being rerun after these changes.
- Final full browser gate: `npm run test:e2e`: **48 passed**, 3.3 minutes, desktop/mobile Chromium, mock providers and a temporary data directory. All earlier failures were resolved without dropping assertions. Screenshot review confirmed inner reading scroll, long-math overflow, GFM tables, sidebar Escape/focus restoration, and recovery controls above the input.

## Final local acceptance — 2026-10-08

| Required command | Result |
| --- | --- |
| `npm run lint` | Passed, no lint errors or warnings |
| `npm run test:run` | 47 files / 448 passed |
| `npm run test:quality` | 1 file / 158 passed; these quality cases are also included in the full unit count |
| `npm run build` | Passed, Next.js 16.3.8, TypeScript and 17 pages |
| `npm run test:e2e` | 48 passed across desktop/mobile Chromium |
| `npm audit --omit=dev --json` | 0 findings, exit 0 |
| `npm audit --json` | 5 high development entries from the documented unpatched braces chain, exit 1 |

Local software changes in A–C and executable D tooling are accepted against these fixtures. Paid model tests, human physics/citation review, recruitment, real keyboards/iOS, hardware-crash recovery, Docker/native Linux verification, backup restoration and deployed observation were not performed. Dense vectors, OCR, a database migration and multiple replicas remain deferred.

Git remains on `main` at `489b001`, with uncommitted implementation files and new regression/tooling documents. The original untracked Chinese plan, Chinese product requirements and root `logo.png` remain present and untouched. `AGENTS.md` includes Next.js' generated guidance. No commit, push, deployment or publication was performed.

The local review service is running at **http://127.0.0.1:3218**. `/api/health` and `/chat` returned 200. It uses a newly created temporary `PLA_DATA_DIR`, an isolated browser origin and loopback binding; the server-default provider key is blank in this process. Existing account files, notes, sessions and `.env.local` remain untouched. Configure a test provider in API Settings for interactive model generation; no paid provider call was made during startup or automated acceptance.

Accepted layout screenshots are in the ignored `test-results/sources-and-responsive-lon-3b269-d-recovery-across-viewports-*/` directories. They are synthetic test artifacts and may be replaced by a future browser run. CI archives failure evidence; local successful screenshot inspection does not establish real-device keyboard or physics quality.

## Implementation files

| Finding | Principal implementation and regression files |
| --- | --- |
| F01 | `workspace-storage.ts`, `UserDataSync.tsx`, `storage.ts`, `workspace-isolation.spec.ts` |
| F02 | `package.json`, `package-lock.json`, `dependency-audit.md`, `dependency-compatibility.test.ts`, CI workflow |
| F03 | `workspace-sync.ts`, `workspace-metadata.ts`, `user-data-client.ts`, `user-data-server.ts`, `session-journal.ts`, `workspace-apply.test.ts`, `workspace-sync.test.ts` |
| F04 | `provider-sse.ts`, `sse.ts`, `generation-stream.ts`, `deepseek.ts`, `read-agent-stream.ts`, provider/API regression tests |
| F05 | `context-manager.ts`, `language.ts`, `exercise-parser.ts`, `prompt-builder.ts`, `context-reliability.test.ts` |
| F06 | `rag/search.ts`, `rag/terms.ts`, `personal-knowledge.ts`, source API, `KnowledgeScopeControl.tsx`, `SourceInspector.tsx`, source/browser regressions |
| F07 | `markdown-math.ts`, `MarkdownRenderer.tsx`, `latex-export.ts`, renderer/export tests, `input-and-math.spec.ts` |
| F08 | `context-manager.ts`, `memory-manager.ts`, `workflow.ts`, `ChatWorkspace.tsx`, context and prompt regressions |
| F09 | `task-workflow.ts`, `practice-parser.ts`, `practice-task.ts`, `AgentGenerator.tsx`, task API tests, `practice-recovery.spec.ts` |
| F10 | `ChatInput.tsx`, `input-and-math.spec.ts` |
| F11 | `draft-checkpoint.ts`, `chat-generation.ts`, `LazyMarkdownRenderer.tsx`, Chat/practice components, `sources-and-responsive.spec.ts` |
| F12 | `feedback-report.ts`, `WorkspaceDataTools.tsx`, `scripts/pilot-report.mjs`, `synthetic-retrieval.ts`, `generation-budget.ts`, pilot review/evaluation documents |

File names above resolve under `src/`, `e2e/`, `scripts/` or `docs/` as appropriate. New tests use synthetic content, mock upstreams and temporary account stores.
