# Retro OTB!! Brand Rollout QA

## Scope
Replaced the remaining legacy OTB image assets across active website chrome, product surfaces, exported artifacts, and install metadata with the supplied retro cream-and-green identity.

## Asset system

| Context | Asset | Rationale |
| --- | --- | --- |
| Header, footer, blog, tournament onboarding, carousel footer | `otb-retro-cream-green-wordmark.webp` | The supplied horizontal identity remains legible in wider brand placements. |
| Compact navigation, status, QR/export, empty-state, and fallback-avatar contexts | `otb-retro-app-icon-512.png` | A centered `OTB` monogram avoids compressing the horizontal wordmark into an unreadable square. |
| Browser favicon | `favicon.ico`, `otb-retro-favicon-16.png`, `otb-retro-favicon-32.png` | Uses the distinctive retro `O` mark, chosen specifically for 16px/32px clarity. |
| PWA and install surfaces | 180px, 192px, 512px, and 512px maskable PNGs | Provides native-sized app imagery and maskable safe-zone coverage. |
| Social preview | `otb-retro-og-card.png` | Replaces the legacy default social card with an on-brand, local 1200×630 preview. |

## Coverage

- Updated all active legacy OTB logo source references in runtime components, including landing and footer chrome, Blog/BlogPost, authentication, Join, tournament setup, Club Dashboard, shared rails, Matchup Prep, Player View, reports/QR exports, the Instagram recap carousel, and the install banner.
- Updated favicon, Apple touch icon, Windows tile, manifest icons, PWA shortcuts, and default Open Graph/Twitter metadata.
- Retained the wordmark for horizontal placements and the compact mark for square placements.
- Added a restrained forest drop shadow to shared header wordmarks so the cream artwork remains distinct in light and dark appearance modes.

## Visual QA

- Verified the live landing header and footer wordmark in dark and light appearance modes.
- Verified desktop and mobile landing, Join, and Blog surfaces.
- Confirmed the mobile install banner shows the new compact mark.
- Confirmed all favicon, PWA, wordmark, compact-mark, and social-preview assets return HTTP 200 with expected image MIME types.

## Automated validation

| Check | Result |
| --- | --- |
| Focused retro brand and affected regression suites | **35 passed** across 8 files |
| TypeScript | Passed |
| Production build | Passed |
| Changed-file ESLint | Passed — 0 errors, 0 warnings |
| Project lint | Passed — 0 errors, 224 established warnings |
| Full Vitest baseline | **7,295 passed / 2 skipped**; 26 established unrelated failures across 18 suites |
| Diff integrity | Passed |

## Notes

- The new favicon intentionally uses the standalone retro `O` rather than the whole wordmark: it stays recognizable at browser-tab scale while clearly matching the supplied artwork.
- Existing unrelated test-suite failures remain tracked as baseline debt and are reported separately from this rollout.
