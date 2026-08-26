# Production Load Baseline — 2026-08-26

## Authorization and Scope

The owner authorized a bounded, read-only production baseline against `https://chessotb.club`. The harness exercised only public GET routes (`/`, `/clubs`, `/tournament/otb-open-2026`, and `/api/clubs`) plus the public club SSE connection. It created no registrations, payments, account sessions, tournament results, or other mutations.

The planned stages were a 30-second five-user warm-up, followed by 60 seconds at 15 users and 60 seconds at 30 users. The run was configured to stop immediately after at least 20 samples if HTTP p95 exceeded 1,500 ms or the error rate exceeded 1%. It also sampled five SSE connections per stage and required the `: connected` response.

## Observed Result

| Stage | HTTP Requests | HTTP Errors | HTTP p50 | HTTP p95 | HTTP Max | SSE Connections | SSE Errors | Stop Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 5-user warm-up | 24 | 0 | 1,954 ms | 2,838 ms | 3,011 ms | 5 | 0 | Stopped: p95 exceeded 1,500 ms |

All sampled HTTP responses returned status 200. All five SSE connections returned `text/event-stream` and the expected `: connected` event, with SSE p50 of 1,840 ms and p95 of 2,249 ms. The absence of errors does not offset the latency breach: the staged plan correctly skipped the 15- and 30-user phases after the warm-up threshold failed.

> This is a valid **negative capacity result**, not a failed test harness. It establishes that ChessOTB’s current public-read latency must be improved or re-baselined before any higher-concurrency claim is made.

## Next Safe Step

Local timing isolated the application from the published-path latency: repeated localhost requests returned 6–20 ms TTFB, while repeated production requests remained 2.0–3.7 seconds TTFB. The owner evaluated Reserved hosting and elected to retain Autoscale. Public GET and HEAD responses now expose a rounded `Server-Timing: app;dur=…` header with no path, user, query, or request identifier. Comparing that application duration with published TTFB will distinguish application time from deployment-path overhead during controlled beta. No hosting change or repeat production load run will occur without new authorization.

Keep the capacity release block active. During controlled beta, collect route-level production timing and preserve the same 1.5-second p95 and 1% error-rate thresholds for any future authorized baseline so results remain comparable.

## References

[1]: ./../scripts/production-load-baseline.mjs "Bounded read-only production load harness"
[2]: ./../RELEASE_DECISION_2026-08-25.md "Current release decision and capacity gate"
