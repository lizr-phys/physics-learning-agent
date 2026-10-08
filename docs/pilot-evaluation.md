# Pilot Evaluation

This document separates software reliability checks, synthetic retrieval evaluation, retained workspace feedback, live-provider checks, and human physics review. Each answers a different question. The repository supplies tests and export tools; student recruitment, paid-model runs, human review, and deployed observation still need to be performed and recorded.

## Automated evidence

| Evidence | What it measures | Boundary |
| --- | --- | --- |
| Unit and integration tests | Account isolation, revisions, deletion replay, provider parsing, bindings, context priority, rendering boundaries, practice structure, recovery, and budgets | Exercises controlled inputs and isolated stores |
| Browser tests | Desktop/mobile interaction, delayed responses, session/account changes, folded answers, source inspection, input composition, overflow, and error recovery | Uses mock providers; Chromium viewport emulation does not establish iOS keyboard behavior |
| Offline routing cases | Named Chinese/English intent and course decisions, including contextual follow-ups | Checks deterministic routing, not final answer quality |
| Bundled-note retrieval cases | Expected documents for a small public sample corpus | Does not represent a user's whole library |
| Synthetic retrieval cases | Expected chunk IDs, bilingual terminology, no-answer rejection, and course boundaries across six course groups | Synthetic text and labels; no subject expert has approved the benchmark |
| Dependency/parser checks | Current dependency findings and extraction compatibility with synthetic documents | Does not establish real scanned-textbook extraction, OCR, or complete security |

The synthetic retrieval fixture in `src/evaluation/synthetic-retrieval.ts` contains 120 queries, including 24 no-answer queries. Its provenance explicitly records that it is synthetic and unreviewed. Report positive-query recall/hit rate/MRR with their denominators, and report no-answer false positives separately. A strong score on deliberately controlled snippets cannot establish citation support or retrieval accuracy on real lecture notes.

Run the reproducible local checks with:

```bash
npm run lint
npm run test:run
npm run test:quality
npm run build
npm run test:e2e
npm audit --omit=dev --json
npm audit --json
```

See [Implementation Progress](improvement-progress.md) for the current run's results and [Dependency Review](dependency-audit.md) for advisory conditions and exceptions. Keep mock-provider, live-provider, and human-reviewed evidence in separate records. Do not fill a missing category with a passing result from another category.

## Workspace feedback and export

An answer can receive a helpful/needs-improvement vote and an optional issue category. Practice problems have stable-ID assessments and optional attempt drafts or stuck-step notes. These remain in the current browser workspace and, for signed-in users, its account snapshot. Clearing a vote or assessment leaves a deletion marker so an old device cannot restore it.

Generation diagnostics record a request ID, safe provider/model/intent labels, terminal state, reason, available timing, output size, and reported usage. Distinct attempts are deduplicated by request ID; at most 100 operational attempts per message are retained. Older histories, cleared feedback, incomplete writes, and absent provider usage can leave gaps. These records therefore describe retained attempts, not a complete production request census.

In **API Settings → Workspace data and pilot feedback**, the user can choose:

- **Export workspace:** a private JSON snapshot containing conversations, practice content, saved citation excerpts, assessments, and safe preferences. Temporary provider keys are excluded.
- **Export feedback summary:** whitelisted aggregate counts and available timing/token distributions, excluding account identities, question/answer text, filenames, source excerpts, attempt drafts, and raw errors.

Synchronization conflict details are available in the same area. Full workspace exports can contain sensitive learning material and should remain private. No report or analytics data is transmitted automatically. Obtain explicit consent before collecting or combining another tester's export.

### Offline report generation

The command-line tool accepts a consented workspace snapshot or a `{ "data": ... }` wrapper. Use Node.js 22.13 or later and a new output filename:

```bash
node --experimental-strip-types scripts/pilot-report.mjs consented-workspace.json pilot-summary.json
```

The tool refuses to overwrite its input or an existing output. It uses the same summary builder as the browser export. Its report includes:

- recorded answers, submitted votes, helpful fraction, and issue counts;
- retained attempt terminals and a completion fraction with its recorded-attempt denominator;
- available duration and first-content p50/p95 measurements with sample counts;
- retrieval statuses, stored practice sets, and assessment counts;
- available reported output tokens with their reporting denominator, with unknown costs left unmeasured;
- an explicit human-physics-review status of `not_performed`.

Helpful fraction uses submitted feedback as its denominator. Silence is neither a positive nor a negative vote. Feedback belongs to an assistant message and should not be attributed to every retry of that message. A solved mark is self-assessment; it does not prove independent completion or mastery. Missing latency, usage, or prices must stay missing rather than becoming zero.

Generation aggregates combine retained chat and practice attempts and deduplicate request IDs. A provider that reports only total tokens does not supply an output-token measurement; that missing field stays unmeasured.

The report does not infer financial cost from incomplete usage. Daily generation output pools are admission controls that reset at midnight UTC and on process restart; they do not replace provider invoices or spending limits.

## Live-provider check record

Use dedicated test accounts, materials, and provider credentials. Explicitly authorize any paid calls, select the model/version, and record the run's budget before execution. Keep credentials out of exported evidence and public issues.

| Run | Observed date and time zone | Provider/model version | Task and language | Output budget | Terminal/partial evidence | Usage reported? | Latency evidence | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| To be filled | To be filled | To be filled | To be filled | To be filled | To be filled | To be filled | To be filled | Not performed |

Check normal completion, an imposed output limit, provider error, transport interruption, user stop, and recovery. Save the relevant safe request IDs and terminal events. A mock SSE trace can demonstrate parser behavior, but cannot establish availability or billing behavior at a real provider.

## Human physics review

Select representative concept, derivation, exercise, and follow-up tasks for the courses and languages used in the pilot. Include sufficient conditions, symbol definitions, boundary/initial conditions, normalization, ensembles, and source support. A format-valid answer still needs subject review.

For a comparison study, fix the question, model/version, output budget, and material. Compare a direct model answer, course/context preparation, and context with personal retrieval. Randomize order and hide the condition labels during review. Report counts, score distributions, disagreements, missing cases, and severe errors; avoid turning a small convenience sample into a claim of learning improvement.

Suggested review dimensions:

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Physical correctness | Incorrect main result | Mainly correct with a local issue | Result and reasoning agree |
| Conditions | A necessary condition is missing | Conditions partly stated | Assumptions and applicable domain are sufficient |
| Symbols/formulas | Conflicting symbols or incorrect expression | Minor definition/display issue | Consistent symbols and readable formulas |
| Explanation | Does not help the next step | Some useful explanation | Clear reasoning and meaningful checks |
| Citation support | Fabricated, irrelevant, or unsupported source | Partial support | The actual supplied excerpt supports the claim |
| Language | Unclear or incorrect terminology | Understandable | Natural course-appropriate language |

Record a severe error separately when a wrong conclusion, missing decisive condition, fabricated citation, or another user's material could mislead the learner. A high total score cannot cancel that finding. Review disagreements require a recorded resolution, preferably involving a second reviewer with the relevant course background.

### Unfilled review record

| Case ID | Course/language | Safe question/answer IDs | Provider/model/version | Conditions and task | Reviewer and background | Scores by dimension | Severe error | Citation support | Decision and regression |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| To be filled | To be filled | To be filled | To be filled | To be filled | To be filled | Not reviewed | Not reviewed | Not reviewed | To be filled |

Human review status: **not performed**. No correctness percentage or sample result is supplied by this template.

## Invitation-only trial

After account/data and generation reliability gates pass on the chosen host, plan a small trial with one or two prepared courses. The suggested initial recruitment window is 10–20 students over 7–14 days. Recruitment and observation are future work; the plan is not evidence that students have participated.

Each tester should attempt a concept follow-up, check an uploaded-note citation, complete a short practice set, and ask about one problem. Include a generation interruption and reload-recovery task. Collect consented observations without making content collection a requirement for basic participation.

| Participant code | Task | Attempted? | Success/partial/failure | Time/help needed | Failure evidence | User observation | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| To be filled | To be filled | To be filled | To be filled | To be filled | To be filled | To be filled | To be filled |

Report task success separately for each task, device class, and response language, with the number attempted and missing observations. Real mobile keyboards, deployed scrolling behavior, backup restoration, provider latency, and seven-day return use require actual observation. Define the test end date, backup and export retention, and deletion procedure with the operator before collecting data.

## Failure attribution and next iteration

| Failure ID | Evidence type | Safe request/set/source IDs | Symptom | Likely layer | Confirmed or unconfirmed | Regression case | Fix and verification | Owner/status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| To be filled | Mock/live/human/user | To be filled | To be filled | UI/sync/provider/context/RAG/format/physics | To be filled | To be filled | To be filled | To be filled |

Keep engineering failure, retrieval relevance, citation support, physical correctness, and user usefulness distinct. Convert confirmed software defects into reproductions and regression tests. Add real-material retrieval labels only after an authorized reviewer verifies the supporting chunks. Use the resulting evidence to choose the next change; leave unanswered product hypotheses and unperformed checks explicitly open.
