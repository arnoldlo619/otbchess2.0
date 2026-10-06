# League Season Card QA

**Scope:** Completed League Dashboard seasons only. Added a first-party, server-rendered share image and one compact `Share Season Card` action to the existing History / Season Summary tab.

## Delivered

- `GET /api/leagues/:leagueId/season-card.png`
  - Generates a **1200×630 PNG** with ChessOTB / Club branding, League name and format, completed-season metadata, champion, and the leading final standings.
  - Uses `@napi-rs/canvas` with vector-only rendering—no remote avatars or external image dependencies.
  - Returns `409` until a League is completed and final standings exist.
  - Sends `image/png` and a one-hour public cache directive so a copied share link remains suitable for social previews.
- The History tab keeps its existing Summary hierarchy and adds a single `Share Season Card` button only when the season is complete and standings exist.
  - Uses native Web Share with the generated PNG file when the device supports file sharing.
  - Falls back to copying the image URL, then opening the image if clipboard permission is unavailable.
  - Retains 44px target sizing, disabled/loading feedback, and compact mobile stacking.

## Validation

| Check | Result |
| --- | --- |
| Renderer unit tests | Passed — PNG signature, exact 1200×630 dimensions, and deterministic rendering |
| Contract + existing League lifecycle tests | Passed — **46 tests** across 3 files |
| TypeScript | Passed — `pnpm exec tsc --noEmit` |
| Changed-file ESLint | Passed with **0 errors**; 5 established `LeagueDashboard` warnings remain |
| Project lint | Passed with **0 errors**; 235 established warnings remain |
| Production build | Passed — `pnpm run build` |
| Completed-season endpoint | Verified against persisted `1904 Sunday League`: **200**, `image/png`, `1200×630`, 165,111 bytes, cache header present |
| Browser interaction QA | Verified the real completed League History tab renders the compact action; clicking it showed `Season card link copied.` in the sandbox browser fallback |
| Card visual QA | Reviewed the generated PNG: readable forest-green composition, clear champion emphasis, readable standings, no emojis or fabricated results |
| Full Vitest baseline | **7,098 passed, 2 skipped, 30 pre-existing failures across 16 unrelated suites**; no League season-card failure |

## Notes

The server card uses the persisted final standings ordered by rank. It does not invent player data, fetch third-party assets, or mutate League state while rendering or sharing.
