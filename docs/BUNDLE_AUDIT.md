# Client JavaScript Bundle Audit

**Audit date:** 2026-08-22  
**Scope:** Client production artifacts, route boundaries, and interaction-only heavy imports.

## Measured artifact baseline

The latest successful local production artifact set available during this audit was generated at **2026-08-22 14:31 UTC**. It contains **141 JavaScript files** totaling **9.41 MiB raw** and **1.87 MiB gzip**. The compiled CSS asset is **476.5 KiB raw**.

> These totals represent all route and feature chunks, not the JavaScript downloaded on first paint. The router already splits pages, so users receive the entry/vendor graph plus only the chunks required by the active route.

| Largest chunk | Raw | Gzip | Loading boundary after this audit |
|---|---:|---:|---|
| PDF export | 610.6 KiB | 179.9 KiB | Director export action |
| React vendor | 532.9 KiB | 167.3 KiB | Shared application runtime |
| Club Dashboard | 522.7 KiB | 70.7 KiB | Club Dashboard route |
| Director | 509.8 KiB | 77.4 KiB | Director route |
| Club Profile | 410.0 KiB | 59.5 KiB | Club Profile route |
| Application entry/shared graph | 396.5 KiB | 77.4 KiB | Initial application load |
| RSVP import | 375.0 KiB | 122.9 KiB | Director modal; parsers now wait for file selection |
| Matchup Prep | 329.4 KiB | 54.8 KiB | Matchup Prep route; image export now waits for click |
| League Dashboard | 278.3 KiB | 36.7 KiB | League Dashboard route |
| Tournament Wizard | 270.0 KiB | 41.7 KiB | Tournament creation interaction |
| Player View | 188.3 KiB | 29.4 KiB | Participant route |
| Broadcast Console | 175.2 KiB | 27.7 KiB | Broadcast Console route |

## Changes completed

Every routed page in `client/src/App.tsx` is now loaded with `React.lazy`, including `PrepAnalysis`, which was the final eager page import. Director PDF generation now loads only after the host selects **Download Results PDF**. Matchup Prep’s `html-to-image` dependency now loads only after **Save as Image**. RSVP CSV and spreadsheet parsers now load only after a file is selected, with explicit parse-failure messages retained.

Repository invariants in `client/src/__tests__/routeCodeSplitting.test.ts` protect all four boundaries from accidental eager imports.

## Next measured priorities

The next low-risk candidates are interaction-only QR rendering in Club Dashboard, League Dashboard, and Tournament Wizard; the conditionally rendered Tournament Wizard inside Club Profile; and specialized Chessnut hardware panels inside Broadcast Console. These should be changed only with flow-specific browser coverage because their parent pages already have route-level splitting.

## Build constraint

A fresh Vite production measurement was attempted once with the project’s established **2300 MB V8 heap ceiling** after browser cleanup. The sandbox terminated the build during transforms with `SIGTERM`, matching the known resource limit from prior checkpoints. TypeScript and focused regressions pass; the successful artifact baseline above is therefore used for total/per-chunk evidence, while the current improvements are validated through source invariants and runtime route tests rather than a newly emitted bundle manifest.

## CI performance budgets

The production-build job now runs `pnpm check:bundle-budget` immediately after `pnpm build`. The checker measures emitted artifacts recursively under `dist/public/assets`, uses deterministic level-9 gzip sizes for JavaScript, and fails when any ceiling is exceeded or expected JavaScript/CSS output is missing.

| Budget | Measured baseline | CI ceiling | Headroom |
|---|---:|---:|---:|
| Total JavaScript across all route/feature chunks, gzip | 1.87 MiB | 2.20 MiB | 17.6% |
| Largest JavaScript chunk, gzip | 179.9 KiB | 210 KiB | 16.7% |
| Largest CSS asset, raw | 476.5 KiB | 525 KiB | 10.2% |

These are **all-artifact regression ceilings**, not first-load transfer claims. They deliberately leave bounded headroom above the latest successful artifact baseline while still blocking accidental eager imports, oversized shared dependencies, or uncontrolled CSS growth. A limit should increase only with a fresh artifact measurement, an updated table, and a documented reason that deferral or code splitting is not appropriate.
