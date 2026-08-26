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

Add route-level timing around the public Clubs and tournament reads, identify the slowest dependency, and repeat the identical staged plan only after a focused latency fix. Keep the 1.5-second p95 and 1% error-rate thresholds unchanged so the next result is comparable.

## References

[1]: ./../scripts/production-load-baseline.mjs "Bounded read-only production load harness"
[2]: ./../RELEASE_DECISION_2026-08-25.md "Current release decision and capacity gate"
