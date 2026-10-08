# Multimodal and interface implementation

Started: 2026-10-08 (Asia/Shanghai). Builds on the local F01–F12 implementation in [improvement-progress.md](improvement-progress.md). Existing Chinese documents, logo, account stores and `.env.local` are retained.

## Implemented behavior

- Default server and new browser/BYOK preferences use `deepseek-flash`, the official DeepSeek V4.1 Flash API identifier. Existing explicit model choices are retained. Official [vision](https://api-docs.deepseek.com/guides/vision/) and [model](https://api-docs.deepseek.com/quick_start/pricing/) documentation were checked on this date.
- Chat and Practice support file selection, pasted screenshots and a mobile camera file picker. Image-only questions work. Images remain attached to saved user turns and safe practice recovery parameters, and accompany per-problem follow-ups.
- OpenAI-compatible, Anthropic and Gemini adapters send native image content parts. DeepSeek Pro rejects image requests explicitly. Model availability and vision capability on other providers remain the operator's responsibility.
- Owned private images are normalized to metadata-free WebP; arbitrary remote URLs and client-supplied image bytes in chat JSON are not accepted. Upload signatures, decoded pixel size, byte counts, per-turn/context counts and account storage quotas are bounded. Repeated context references are transmitted once.
- Anonymous and signed-in images stay separate. Web Locks establish one anonymous identity across tabs. Sign-in import copies images only after the existing explicit choice, preserves originals, remaps references, and rolls back partial failures. Upload/import callbacks reject stale identities. Account references block deletion through the unused-upload manager.
- Chat, Map, Practice, Personal Knowledge and API Settings retain their main workflows with shorter copy, flatter layout and expandable advanced controls. English navigation, bilingual replies, session management, retrieval scopes, folded answers, BYOK and `.tex` export remain available.
- Application file tracing excludes private runtime data and environment files. Image files remain in `PLA_DATA_DIR`, outside build artifacts.
- Personal Knowledge Base includes a photo problem library for exams and homework. Vision recognition organizes questions, given conditions, diagrams, topics and unclear details without solving or inventing sources. Users edit and confirm the transcription before it enters the existing Markdown index. Records retain category, title, original images and source notes; library filters and owner-checked viewing lead into Chat with image and document scope attached.
- Interrupted recognition drafts survive navigation and refresh through scoped checkpoints. Manual transcription remains available. Identical concurrent save retries create one note. The shared account lock coordinates saving image references with deletion, and notebook references prevent unused-image removal.

## Limits and boundaries

Four images per turn; eight unique images per request including history; JPEG/PNG/WebP/GIF up to 10 MB and 25 megapixels; normalized longest side 2560 pixels and size 2 MB; 50 MB / 256 images per workspace. GIF reads its first frame. Cropping is recommended for small handwriting. Unreadable labels or conditions should trigger clarification rather than invented numbers.

This is image understanding support. Native audio/video, provider Files API reuse, scanned-PDF vision and automatic OCR ingestion are not implemented. The searchable document pipeline extracts text, including explicitly reviewed photo transcripts. Workspace JSON and `.tex` exports do not embed source image bytes; image copies can be saved from the private image viewer. Photo notes are stored in the private library rather than the conversation export. Recognition drafts and recognition usage are not included in the pilot aggregate report. Physical camera/clipboard behavior on iOS and actual model interpretation need subsequent live testing.

## Evidence

- Private storage and route tests use real Sharp decoding of synthetic PNG bytes, temporary directories and synthetic identities. They cover malformed/oversized images, cross-account/guest denial, stale headers, explicit imports, partial-import rollback and safe deletion.
- Adapter and chat tests use mock upstreams. They check three protocols, image deduplication, visual context limits, owned-byte resolution and exclusion of keys/bytes from public persistence and SSE.
- Client tests check stable anonymous identity, delayed upload rejection and reference remapping. Browser scenarios cover upload, paste, image-only send, conversation switching, refresh/follow-up, account import, cross-account denial and unfinished image-based practice recovery on desktop/mobile Chromium.
- Lint passed. The first unit gate passed 51 files / 469 tests; two additional chat regressions require the final gate. Offline quality passed 158 cases, a subset of the full unit count. The first build passed, then runtime file tracing was corrected and scheduled for revalidation.
- Production audit: zero findings. Full audit: five high entries in the same unpatched development `braces` chain documented in [dependency-audit.md](dependency-audit.md). Sharp 0.35.5 is now a direct dependency matching the already resolved patched version.
- The first browser run exposed two new-test locator mistakes for implicit select labels. Selects retain accessible names; the fixtures now use semantic combobox roles. Final browser and visual results will be appended after verification.

No paid provider request, real learner data, live-model accuracy evaluation, human physics review or deployment is included in this evidence.

## Final local acceptance

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run test:run` | 52 files / 477 passed |
| `npm run test:quality` | 158 passed; included in the unit total |
| `npm run build` | Passed with Next.js 16.3.8 and TypeScript; private-file tracing warnings resolved |
| `npm run test:e2e` | 64 passed, 4.3 minutes, desktop/mobile Chromium |
| Targeted check after photo-context wording | 2 files / 12 passed |
| Production dependency audit | Zero findings |
| Full dependency audit | Five high development entries in the documented unpatched chain |
| Build trace check | 24 traces; zero private data or environment references; no `.env.local` or `.pla-data` in standalone output |

The final browser run retains all assertions from the first run. Semantic combobox locators fixed the two fixture mistakes; no functional assertions were removed. Screenshot inspection covered all five pages on both viewports, then verified the compact practice controls and the new authenticated photo library. Practice generation is visible before its optional controls, and image thumbnails preserve their aspect ratio. The design detector reported no findings on the changed interface and new photo components.

GitHub upload was requested by the user. Source, regression tests, project documentation and the supplied project logo are included; environment secrets, local runtime data, temporary accounts, traces and build artifacts are excluded. No deployment action is part of this handoff. The development preview uses a separate temporary data directory and a blank server provider key; BYOK can be configured in the preview without changing `.env.local`.
