# Pilot quality baseline

This directory contains a deterministic, offline evaluation set for the learning workflow. It is intended to catch product regressions before a small user pilot without calling a paid model API.

The current baseline covers:

- physics, practice-generation, study-planning, general, and product-help intents;
- Chinese and English course resolution across the six supported course groups;
- rank-one retrieval from the bundled mathematical-physics and electrodynamics notes;
- high-risk boundary cases such as non-physics requests inside an existing physics conversation.

Run it with:

```bash
npm run test:quality
```

These fixtures measure deterministic routing and retrieval, not final model correctness. During a pilot, answer feedback and practice self-assessment should be reviewed alongside sampled model outputs. Add anonymized failure patterns as new fixtures instead of tuning only against individual prompts.
