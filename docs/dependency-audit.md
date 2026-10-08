# Dependency review

Review dates: 2026-10-07 and 2026-10-08 (Asia/Shanghai). This review covers the local npm lockfile, advisory conditions, and compatibility checks. An audit entry is a dependency finding, not a confirmed exploit in this application.

The October 8 vision implementation declares Sharp **0.35.5** directly, matching the patched native version already resolved by Next.js. Upload signatures reject SVG/AVIF and unsupported formats before decoding; pixel and byte limits bound accepted raster input. The production audit remains **0 findings** and the full audit remains the same **5 development high entries** after this addition.

## Reproducible audit

```bash
npm audit --json
npm audit --omit=dev --json
npm ls next eslint-config-next officeparser pdfjs-dist @xmldom/xmldom sharp postcss katex --all
```

The initial tree has **23 full-tree entries**: 1 critical, 15 high, 3 moderate, and 4 low. The production-only audit has **13 entries**: 1 critical, 7 high, 1 moderate, and 4 low. These are fresh results, distinct from the September historical counts.

## Upgrade decisions

| Dependency | Initial version | Selected version / policy | Reason |
| --- | --- | --- | --- |
| Next.js and eslint-config-next | 16.2.11 | 16.3.8, matching versions | Same major; includes the current Next.js security fixes |
| officeparser | 7.2.3 | 8.1.1 | Supplies PDF.js 6.2.108 and xmldom >=0.9.12; existing AST/chunk API retained |
| Vitest | 4.1.10 | 4.1.11 | Same minor; fixes the mock redirect traversal advisory |
| KaTeX | 0.17.0, plus nested 0.16.x | 0.18.10; shared `katex: "$katex"` override | Patched >=0.18.2; renderer plugins and imported CSS use the same version |
| sharp | 0.35.3 override | Remove obsolete override; inspect resolved version | The old override prevents patched native libraries |
| PostCSS | 8.5.15 override under Next.js | Remove obsolete override; inspect resolved tree | Next.js declares the patched PostCSS line |
| remark-gfm | Absent | 4.0.1 | Enable Markdown tables; covered by renderer checks |

`npm audit fix --force` is deliberately not used. In particular, audit's suggested downgrade of eslint-config-next to 14.x would break the matching Next.js configuration without fixing the source dependency properly.

officeparser 8 raises the runtime floor to Node.js **22.13**. `package.json` records that requirement; CI and Docker already use Node.js 22, and the local runtime is 24.14. The application uses `parseOffice()` and `ast.to("chunks")`, not removed APIs. PDF extraction output may change because version 8 improves reading order and structure. Existing stored documents are preserved; rebuilding their indexes remains an explicit operation. See the [official officeparser 8 release notes](https://github.com/harshankur/officeParser/releases/tag/v8.0.0).

## Advisory reachability

| Finding | Application conditions and disposition | Primary source |
| --- | --- | --- |
| Next.js Windows server RCE | This workspace runs Windows and does not enable Cache Components. A public Windows-hosted server therefore needs the patch; a successful build is not a mitigation. Fixed from 16.3.3. | [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) |
| Next.js AVIF image optimization | Requires AVIF decoding in the image optimization path. Existing `next/image` uses local static `/logo.png`; untrusted remote image optimization is not configured, and personal uploads are private. The framework dependency is patched from the 16.3.3 security floor. | [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) |
| Next.js Node ImageResponse RCE | A new September advisory requires attacker-controlled SVG values passed to Node `next/og`. No such import was found here. Patched from 16.3.6 anyway. | [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) |
| sharp libheif / librsvg | AVIF decoding and, for the newer librsvg RCE, specific glibc Linux runtime conditions are relevant. The latter matters to the intended Linux container even though local Windows is different. Remove the pin and require >=0.35.5. | [libheif advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c), [librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) |
| PDF.js scripting | The announcement concerns malicious PDFs with enabled scripting and no restrictive CSP. This application extracts text server-side through `getDocument`, rather than embedding a PDF scripting viewer. Exploitability was not demonstrated; the upgraded parser removes the affected version. | [Mozilla advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j) |
| xmldom XML memory / parsing | Authenticated office uploads contain untrusted XML. ZIP byte limits do not address every XML complexity issue. Upgrade to the patched 0.9.12 line via officeparser. | [xmldom advisory](https://github.com/xmldom/xmldom/security/advisories/GHSA-965w-775f-mr7g) |
| PostCSS source maps | Exploitation requires processing attacker-controlled CSS/source-map references. Uploaded notes do not enter the CSS compiler; the dependency is nevertheless updated. | [PostCSS advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) |
| KaTeX prototype pollution gadget | Requires another source of prototype pollution or control over renderer options. The application does not expose options to model text. The patch starts at 0.18.2. | [KaTeX advisory](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7) |
| braces deeply nested patterns | No patched npm release exists at review time. It is present only in the development ESLint glob chain; runtime routes do not accept glob patterns. Track the remaining development exception below. | [GitHub advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |

## October 8 audit refresh

The first October 7 upgrade to 16.3.6 passed the production audit then. A fresh October 8 npm advisory response adds one Next.js production entry (six advisories), bringing that intermediate tree to one production high entry and six full-tree high entries. The lockfile was therefore advanced to **Next.js and matching eslint-config-next 16.3.8**, the minimum patched 16.3 version reported by the current npm audit data; the unrelated 16.4 minor release was not required.

| Newly surfaced advisory | Reachability in this repository |
| --- | --- |
| [Image optimization SSRF](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4) | Requires an attacker-controlled allow-listed remote image URL. The current configuration has no `images.remotePatterns`, so this path is not enabled; the framework is patched regardless. |
| [Development MCP disclosure](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv) | Applies to `next dev` rather than production. Relevant to local development, so loopback binding alone is not treated as a substitute for the framework fix. |
| [Draft Mode cache disclosure](https://github.com/vercel/next.js/security/advisories/GHSA-3w37-wq28-93x7) | The application has no Draft Mode or `use cache` implementation. No exploitability is claimed. |
| [Self-hosted SSG/ISR cache poisoning](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676), [cross-user SSG/ISR substitution](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p) | Public pages are prerendered; account, source and workspace APIs use request authentication and private no-store responses. The framework fix is still applied for the planned self-hosted topology. |
| [Metadata image route disclosure](https://github.com/vercel/next.js/security/advisories/GHSA-f87g-xv8r-7p7x) | No authenticated dynamic metadata-image handler is implemented. No private image route was used to demonstrate this issue. |

The advisory web pages displayed an incomplete patched-version placeholder at review time; the exact affected range and the 16.3.8 release were cross-checked against the current npm audit record and registry. Final audit and build evidence below supersede the intermediate October 7 counts.

## Verification status

| Check | Observed result |
| --- | --- |
| `npm install` with matching framework/parser updates | Passed; no forced audit repair |
| `npm update baseline-browser-mapping brace-expansion browserslist js-yaml` | Passed; compatible transitive patches only |
| `npm audit --omit=dev --json` | **0 findings**, exit 0 |
| `npm audit --json` | **5 high entries**, exit 1; all represent the same unpatched development `braces` chain |
| `npm run test:run -- src/rag/dependency-compatibility.test.ts src/rag/document-loader.test.ts src/lib/personal-knowledge.test.ts` | 3 files, **10 tests passed**; personal store tests use isolated temporary data |
| Durable synthetic parser regression tests | RTF, text PDF, DOCX, XLSX, and PPTX all yielded readable chunks through the real application loader; PDF page, slide number, and sheet metadata verified |
| Durable Windows x64 sharp native regression | PNG → AVIF → resize → PNG passed in memory; sharp 0.35.5, libheif 1.23.5 |

Final resolved versions: Next.js / eslint-config-next **16.3.8**, officeparser **8.1.1**, PDF.js **6.2.108**, xmldom **0.9.12**, sharp **0.35.5**, Next.js PostCSS **8.5.23**, KaTeX **0.18.10**, Vitest **4.1.11**, remark-gfm **4.0.1**, nanoid **3.3.20**, source-map-js **1.2.2**, baseline-browser-mapping **2.11.27**, brace-expansion **1.1.21**, browserslist **4.29.3**, and js-yaml **4.3.2**. These versions are recorded in `package-lock.json`.

The remaining full-audit entries are `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, and `eslint-config-next`. They are transitive reports of one advisory, not five demonstrated application attack paths. The full audit intentionally remains nonzero until upstream fixes it; the production audit is the runtime gate.

The parser smoke uses synthetic buffers only. It checks extraction compatibility, not OCR or layout fidelity on real textbooks. Native Linux/Docker checks and the final application lint, build, renderer, quality, and browser tests are tracked in [the implementation progress record](improvement-progress.md). No container was built during this dependency review.

## Remaining exception

`braces <=3.0.3` currently has no patched release. Until upstream ships a fix, use only repository-controlled lint/build glob patterns, keep developer tools off public network interfaces, and use the standalone production artifact. Do not run lint/build jobs on arbitrary uploaded projects or interpret uploaded text as glob patterns.

Owner: project maintainer (an individual must be assigned before pilot release). Review deadline: **2026-10-21**, or immediately when a patched braces / ESLint dependency release appears. This is a development-chain exception, not an assertion that its vulnerability is fixed.

No real user data, model keys, remote account content, or production deployment was used in the review. Passing these checks does not establish physics-answer correctness or complete application security.
