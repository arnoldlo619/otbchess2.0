# Landing QR Showcase + Headline QA

**Scope:** Replace the first How It Works QR-share mockup with the supplied live ChessOTB join screen and simplify the section headline.

## Completed behavior

- Replaced the first `Share your QR Code` showcase asset with the supplied `landing-qr-share-showcase.png` capture.
- Preserved the established MacBook display frame while adding an explicit, typed per-step image-fit option.
- Applied `object-fit: fill` only to the supplied QR-share screen, so the complete QR screen fills its presentation surface without changing the crop behavior of other landing images.
- Updated the visual section heading to **“Chess Tournaments Made Simple.”**
- Kept the document hierarchy valid: the page-level Hero remains the single H1 and the How It Works section remains an H2.
- Added descriptive alt text and lazy/asynchronous image loading for the below-the-fold showcase image.

## Validation

| Check | Result |
| --- | --- |
| Targeted Home visual + landing copy suites | 13 passed across 3 relevant suites |
| TypeScript (`pnpm exec tsc --noEmit`) | Passed |
| Changed-file ESLint | Passed with no errors |
| Project lint (`pnpm lint`) | 0 errors / 233 established warnings |
| Production build (`pnpm run build`) | Passed |
| Asset integrity | PNG present; 1917×955 RGBA |
| Local route health | `/` and `/images/landing-qr-share-showcase.png` returned HTTP 200 |
| Browser QA | Headline present; image reports `object-fit: fill`, descriptive alt text, lazy loading, and a 577×360 desktop rendered surface |
| Responsive QA | Full-page desktop (1440px) and mobile (390px) captures show the new QR showcase without horizontal overflow |
| Full Vitest baseline | 7,180 passed, 2 skipped; 29 known unrelated legacy failures across 17 suites. No Home/landing regression failed. |
| Aggregate image-loading suite | Existing threshold failure: 32 optimized images vs stale expectation of 35; unrelated to this change and present without QR asset regression |

## Follow-up

Keep the aggregate image-loading threshold unchanged in this visual-only task. It is not affected by the QR showcase asset or its loading attributes.
