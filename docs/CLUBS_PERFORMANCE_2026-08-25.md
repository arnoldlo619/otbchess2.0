# Clubs Discovery Performance — 2026-08-25

## Outcome

The Clubs discovery page now reserves its initial featured-card layout, promotes only the first visible banner with eager/high fetch priority, and leaves later card media lazy. This removed the data-arrival layout shift while preserving the existing mobile and desktop design.

The public Clubs API previously returned embedded base64 banner and avatar data. All 17 remaining embedded images were decoded, resized without changing aspect ratio, converted to WebP, uploaded to permanent project storage, and replaced in the database. EXIT! CHESS CLUB’s existing banner and avatar were also replaced with appropriately sized WebP derivatives.

| Metric | Before | After | Result |
|---|---:|---:|---:|
| Public clubs response | 444,531 bytes | 12,346 bytes | 97.22% smaller |
| Embedded image fields in `clubs` | 17 | 0 | Eliminated |
| Migrated embedded image bytes | 387,733 bytes | 143,712 bytes | 62.94% smaller |
| EXIT banner/avatar source bytes | 343,856 bytes | 149,194 bytes combined | 56.61% smaller |
| Clubs CLS, desktop/mobile | 0.421–0.442 | 0.022–0.081 | Within 0.10 budget |
| Warm Clubs LCP, desktop/mobile | 0.75–0.86 seconds | 0.72–0.75 seconds in final matrix | Within 2.5-second budget |

## Cold-Load Interpretation

The local Vite development server’s cold result is dominated by module compilation before the first Clubs API request begins. Final diagnostics showed the API, image, and render work completing within roughly 200 milliseconds after application code started. Production cold-load validation remains part of the deployment checklist because the sandbox cannot reliably produce the production bundle without resource termination.

## Regression Coverage

The browser suite now enforces a public clubs payload ceiling of 100 KB, rejects embedded image data, verifies exactly one promoted visible banner with all later banners deferred, and includes `/clubs` in the existing LCP/CLS route matrix. Existing public club discovery, profile, tabs, guest creation preview, and League demo flows continue to pass across desktop and mobile Chromium.
