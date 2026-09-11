# QR Join Mobile Blank-Page Incident Assessment

**Scope:** Read-only analysis of the active three-round Double Swiss tournament QR-join issue. No product code, tournament settings, player records, or live state were changed.

## Executive assessment

This does **not** appear to be a deterministic incompatibility with a particular phone brand or operating system. The evidence supports an intermittent client bootstrap failure that becomes more likely for a phone with stale cached application assets, a weak or interrupted connection during launch, or browser settings that deny Web Storage. The active tournament's invite-code resolver responded correctly at the time of inspection, so the core invite lookup is available.

The strongest production evidence is a cluster of module-load failures around participant waiting-lobby navigation: `Importing a module script failed` at **00:24:45** and **00:24:47 UTC** on `/tournament/:id/play`, plus an earlier failed lazy module fetch. The join and waiting-lobby pages are lazily loaded. A failed lazy module fetch rejects the dynamic import, which browsers report as a `TypeError`; common triggers are network failure, HTTP errors, and stale asset references.[3]

| Priority | Finding | Confidence | Why it matters |
|---|---|---:|---|
| P0 | A stale or unavailable JavaScript chunk can fail while the QR route or player lobby is being loaded. | **High** | Production logged multiple module-script failures during the affected player-lobby route window. |
| P0 | The global theme bootstrap performs unguarded `localStorage` reads and writes; the error boundary then performs unguarded `sessionStorage` access while recovering from a chunk error. | **High** | A browser that blocks site storage can turn a recoverable render failure into a blank page. |
| P1 | The active tournament is persisted with `is_public = 0`; fresh QR devices therefore receive a 404 from the general public-tournament snapshot request. | **High** | The join resolver still works, but the 404 is swallowed and weakens fresh-device status/lifecycle behavior. |
| P1 | QR joining relies on a client-local registry plus embedded URL metadata before falling back to the server resolver. | **Medium** | Most camera apps preserve the full URL, but any altered/expired/stale QR payload makes the client path more fragile than a server-first join flow. |
| P2 | The resolver accepts invite codes and exact custom slugs, but not a tournament ID fallback and not a case-normalized custom slug. | **Medium** | It is not implicated in this live invite-code check, but is an avoidable recovery gap when hosts circulate copied links. |

## Verified evidence

The active Double Swiss record is **in progress**, has three rounds, and has the persisted invite code `9YZYSGSE`. Its server-side invite resolver returned HTTP 200 with the expected tournament metadata during this assessment. Therefore, a manual code entry or a QR URL retaining that invite code can resolve server-side today.

The same tournament is marked `is_public = 0`. The generic `GET /api/public/tournament/:slug` route filters for `is_public = 1`, and the production log records 404 responses for the affected tournament identifier. The Join page swallows that optional status-fetch failure; the player lobby uses a separate live-state path. This mismatch is **not sufficient on its own to explain a blank first page**, but it is a confirmed reliability defect around a fresh-phone join flow.

The page shell lazily imports `JoinPage` and `PlayerView`. Its error boundary attempts one reload for chunk-load failures. However, the error boundary calls `sessionStorage` without a guard, and the theme provider calls `localStorage` without a guard before the Join page renders. MDN documents that storage may be present but unavailable under browser settings, and that privacy or cookie-blocking policies can raise `SecurityError` for localStorage access.[1] [2]

> The practical pattern is a failure chain: a phone opens the QR URL, a lazy chunk fails or a restrictive browser blocks storage, the recovery surface also touches unavailable storage, and the user sees little or no rendered recovery UI.

## Phones and settings most likely to expose the issue

| Context | Risk level | Rationale | Immediate participant guidance |
|---|---:|---|---|
| Older browser session after a recent deployment, especially with cached tabs or an installed PWA | High | A shell from one deployment can request a code-split asset no longer available at the expected URL. | Fully close the old ChessOTB tab/PWA and reopen the fresh join link in the browser. |
| Weak Wi-Fi, captive portal, venue Wi-Fi handoff, or cellular transition while the page opens | High | Dynamic module loading requires a successful JavaScript fetch before the route can render. | Switch network once, then reopen the current join link. |
| QR camera that opens an embedded in-app webview rather than Safari/Chrome | Medium–high | Webviews vary in cookie, storage, cache, and module-loading policy. | Choose **Open in Safari/Chrome** rather than continuing in the preview/webview. |
| Cookies/site data disabled, aggressive privacy browser, managed-device policy, or a storage-constrained private context | Medium–high | The current root bootstrap depends on unguarded localStorage; some policy choices make storage unavailable.[1] [2] | Use a normal Safari/Chrome tab with site data allowed for ChessOTB. |
| Current Safari or Chrome on an ordinary connection with normal storage | Low | The browser capabilities needed for the QR link and dynamic import are standard. | Use the fresh QR or manual invite code if a transient load interruption occurs. |

## Recommended remediation plan — do not implement until approved

### 1. Stabilize the QR entry shell and recovery UI — P0

Create a minimal, non-lazy QR entry shell that is always able to render a clear recovery state before the heavier Join route loads. Make storage optional by introducing safe storage wrappers at the theme and error-boundary bootstrap level. If a chunk fails, show a deterministic **Reload Join Page** action and a visible manual invite-code fallback rather than relying on a storage-backed auto-reload alone.

This is the highest-leverage fix because it prevents a blank page regardless of whether the initiating cause is an older cache, weak network, or a restricted webview. It also ensures that an incident is diagnosable by the participant and director instead of silently failing.

### 2. Make QR join server-first and independent of client-local tournament state — P0

On `/join/:inviteCode`, resolve a minimal safe tournament payload directly from the server before rendering the registration form. The QR code should contain a short canonical invite URL; embedded metadata can remain an optional performance enhancement, not a prerequisite for a fresh device. The join page should derive tournament ID, lifecycle status, capacity, format, and rating type from this server response.

The persisted player registration already has a server-authoritative step. Extending that principle to the initial QR bootstrap removes the current dependence on a phone's local registry and makes all camera/browser contexts follow the same path.

### 3. Separate participant join access from public dashboard visibility — P0

Add a purpose-built join-metadata endpoint that is available for a valid invite code even if `is_public` is false. Alternatively, set the precise required public flag when a tournament's QR join flow is enabled, but do not broaden public dashboard exposure accidentally. Remove the Join page's dependency on the public-tournament snapshot for lifecycle checks.

The active event demonstrated this mismatch: the invite resolver worked while the public snapshot returned 404. The corrected contract should allow QR joining and player-lobby hydration without requiring that a tournament be exposed as a broadly public spectator page.

### 4. Make deployment cache transitions deterministic — P1

Version service-worker caches from the build/deployment identity instead of a manually maintained static cache name. Use a manifest-aware precache strategy for entry chunks, activate the new worker predictably, and provide a visible refresh state when an older shell encounters an unavailable asset. Keep navigation responses network-first, but do not allow a stale shell to strand a participant at the point of entry.

### 5. Add QR-specific observability and a real-device test matrix — P1

Record a privacy-safe event for join bootstrap stage, build version, chunk error category, storage availability, server-resolve status, and recovery result. Do not record usernames or the raw QR metadata payload. Test the same tournament invite on current iOS Safari, iOS Chrome, Android Chrome, Samsung Internet, an installed PWA, private/restricted storage, an in-app webview, and a throttled/interrupted network. Each case must render either the join form or a recoverable error card—never an empty page.

## Safe operational workaround for the running tournament

Until the product remediation ships, the director can give an affected player the current invite code `9YZYSGSE` and ask them to open the standard browser directly at `https://chessotb.club/join`, then enter the code manually. If the QR camera opens an embedded preview, they should choose **Open in Safari** or **Open in Chrome** first. If the page remains blank, close any existing ChessOTB tab or installed app window, reopen the link once on a stable connection, and avoid private/cookie-blocked mode for that registration attempt.

This workaround does not alter tournament data. It relies on the server resolver that was verified as available during this assessment.

## Acceptance criteria for a future implementation

| Scenario | Required outcome |
|---|---|
| Fresh phone scans current QR on normal cellular/Wi-Fi | Join form renders with the correct tournament details. |
| Phone has an older app shell when a new release is deployed | User receives a clear refresh/retry surface, then reaches Join—never a blank page. |
| Storage is unavailable | Join remains usable or displays a clear browser-settings recovery card. |
| QR query metadata is missing or altered but invite code remains | Server resolves the invite and continues the join flow. |
| Tournament is joinable but not a public spectator dashboard | Join and player lobby work without a public-snapshot 404. |
| In-app webview or interrupted connection | A browser-open fallback and manual invite-code path remain visible. |

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API "MDN: Using the Web Storage API"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage "MDN: Window localStorage"
[3]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import "MDN: import()"
