# Offline quality checks

This directory contains a deterministic, offline evaluation set for the learning workflow. It is intended to catch product regressions before a small user pilot without calling a paid model API.

The fixtures cover:

- physics, practice-generation, study-planning, general, and product-help intents;
- Chinese and English course resolution across the six supported course groups;
- rank-one retrieval from the bundled mathematical-physics and electrodynamics notes;
- high-risk boundary cases such as non-physics requests inside an existing physics conversation.
- 120 synthetic retrieval queries across six course groups, including bilingual terms and 24 no-answer queries; these labels have not been human reviewed.

Run it with:

```bash
npm run test:quality
```

These fixtures measure deterministic routing and retrieval, not final model correctness. The synthetic corpus is deliberately controlled; its scores do not establish relevance or citation support on real lecture notes.

`feedback-report.ts` builds an explicitly exported aggregate report from retained chat and practice attempts, answer votes, and practice self-assessment. It omits identities, learning text, provider keys, and source excerpts, and preserves missing measurements. The browser export and `scripts/pilot-report.mjs` share this builder. See [Pilot Evaluation](../../docs/pilot-evaluation.md) for consent, denominators, unfilled human-review records, and the separate live-provider workflow.
