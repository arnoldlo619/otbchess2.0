# ChessOTB.club Release Decision

**Decision date:** August 25, 2026  
**Scope:** Controlled beta readiness, public marketing readiness, paid-flow readiness, deployment controls, and rollback controls  
**Prepared by:** Manus AI

> **Decision: CONDITIONAL GO for controlled free-beta onboarding. NO-GO for broad paid marketing or paid membership launch until the P0/P1 gates below are closed.**

The current source is materially stronger than the August 21 platform audit. Security hardening, route decomposition, request-correlated error handling, Sentry integration, refresh recovery, Web Vitals, SSE reconnect telemetry, internal-link validation, and bundle-budget enforcement are now present and regression-tested.[1] [2] [3] The live production health endpoint is responding, but release safety is not determined by health alone.[4]

The main blockers are operational rather than architectural. The currently published landing page still contains unverifiable testimonials, a hardcoded host rating, and inflated fallback platform counts. Those claims have been removed in the current source with regression coverage, but the corrected release candidate must be published and verified before any marketing resumes. GitHub `main` now carries the active workflow, and the verified remote run passed TypeScript, ESLint, internal-link validation, 6,770 deterministic unit/integration tests, the production build, and the bundle budget on August 26, 2026.[2] [10]

## Release posture

| Launch mode | Decision | Conditions |
|---|---|---|
| Internal QA and founder testing | **GO** | Use the current release-candidate checkpoint and keep production writes controlled. |
| Small free-beta cohort | **CONDITIONAL GO** | Publish the claim-integrity fix, complete the smoke checklist, and monitor error, Web Vitals, and SSE telemetry. |
| Broad public marketing | **NO-GO** | First close P0-01 and P1-03/P1-04 so production content, paid-flow behavior, and capacity are verifiable. |
| Paid Pro membership launch | **NO-GO** | First complete the full Stripe checkout, webhook, cancellation, and success-page production flow. |
| Large-event or high-concurrency promotion | **NO-GO** | First establish a production-like load baseline and confirm Autoscale latency/error behavior. |

## Evidence snapshot

| Area | Current evidence | Assessment |
|---|---|---|
| Application routing | 72 route declarations and 64 lazy page modules in `App.tsx`; canonical route and internal-link contracts run in CI.[1] | Strong |
| Unit regression baseline | The activated CI run completed 335 deterministic unit/integration files and 6,770 tests; browser E2E and live credential probes remain deliberately separate.[10] | Strong |
| Browser regression | 24 Playwright specification files cover representative tournament, community, training, marketing, accessibility, resilience, performance, and telemetry flows.[1] | Strong for current stage |
| Type safety and lint | TypeScript and zero-error lint are explicit CI gates and have passed across the recent checkpoint batches.[1] [2] | Strong |
| Production build | The activated remote CI build completed successfully in 55 seconds, including post-build bundle-budget enforcement. The local sandbox limitation remains documented but no longer blocks artifact verification.[3] [10] | Strong |
| Bundle control | Documented ceilings enforce 2.20 MiB total JS gzip, 210 KiB largest JS gzip, and 525 KiB largest raw CSS after a production build; the current remote run passed them.[3] [10] | Strong |
| Security | Restricted CORS handling, parameterized Drizzle SQL fragments, server validation, Sentry, structured logs, request IDs, and a global error handler are present.[1] [6] | Good for controlled beta |
| Resilience | Join, tournament creation, club creation, RSVP building, and Director result state have desktop/mobile refresh recovery; drafts exclude data URLs and clear only after authoritative success.[1] | Strong |
| Observability | Client/server error capture, route-pattern-only Web Vitals, and all-EventSource disconnect/recovery telemetry are rate-limited and strictly validated.[7] [8] | Strong |
| Live availability | `https://chessotb.club/api/health` returned `status: ok` during this audit.[4] | Healthy at audit time |

## Severity register

### P0: release blocking

| ID | Finding | Evidence | Required closure |
|---|---|---|---|
| P0-01 | The published landing page still presents unverifiable testimonials, a hardcoded `4.9` host rating, and inflated fallback platform counts. The current source removes these claims and keeps counters tied only to live database values. | Live production audit plus `Home.tsx`, `platformStats.ts`, and claim-integrity regressions.[4] [9] | Publish the current release candidate. Confirm the testimonial section, host rating, and fallback floors are absent on desktop and mobile before resuming marketing. |

No additional P0 product-functionality defect was proven in the audited tournament, Join, club, RSVP, or Director flows. Historical P0 names in regression files represent fixed defects protected by tests, not open blockers.[1]

### P1: close before broad marketing or monetization

| ID | Finding | Risk | Required closure |
|---|---|---|---|
| P1-01 | **Resolved.** The owner-authorized browser commit activated `.github/workflows/ci.yml`; run `32916972360` completed successfully. | GitHub App workflow-write permission remains intentionally unavailable, but CI is now active. | Maintain the preserved template and use an owner-authorized workflow change when CI definition updates are necessary.[10] |
| P1-02 | **Resolved.** The current remote SHA completed the production build and bundle-budget gate successfully. | The local Vite sandbox remains resource-constrained, but remote artifact verification is active. | Require each future `main` SHA to retain a green CI run before release.[10] |
| P1-03 | Stripe checkout, successful subscription webhook, cancellation webhook, and `/pro/success` polling remain unverified end to end in production. | Users could pay without entitlement updates or receive inconsistent membership state. | Keep paid acquisition disabled until all four production scenarios pass with test accounts and auditable Stripe events. |
| P1-04 | The authorized read-only production baseline stopped during its 5-user warm-up: all 24 HTTP requests and five SSE connections succeeded, but HTTP p95 was 2,838 ms, exceeding the 1,500 ms stop threshold. The 15- and 30-user stages were correctly not run. Local application timing remained 6–20 ms, while repeated published requests remained 2.0–3.7 s TTFB, indicating deployment-path overhead. The owner elected to retain Autoscale rather than upgrade hosting. | Capacity at marketing scale remains unproven; the current public read path does not meet the stated latency gate. | Keep the capacity block and compare published TTFB with the new rounded `Server-Timing: app;dur=…` header during controlled beta; repeat the same staged plan only after an authorized measured remedy.[11] |

### P2: address during controlled beta

| ID | Finding | Treatment |
|---|---|---|
| P2-01 | **Resolved.** The Chessnut beta feature, its device routes, browser adapters, operator controls, diagnostics, bridge API endpoints, and dedicated tests were retired. | Manual and PGN broadcast input remain the supported paths. |
| P2-02 | Large modules remain, including `server/index.ts`, Director, and Club Dashboard. | Continue extraction by domain while preserving route and browser regressions; this is a maintainability risk, not a launch blocker. |
| P2-03 | Global content/design checklist items remain open, including labels, contrast, capitalization, placeholder review, and League demo polish. | Close route by route during beta. Do not claim platform-wide completion until audited. |
| P2-04 | Autoscale cold-start and sustained-event behavior have observability but not a passing measured capacity envelope. Reserved hosting was evaluated and declined after the initial latency baseline. | Monitor the beta cohort and preserve the 1.5-second p95 gate before any high-concurrency promotion. |

### P3: planned improvement

| ID | Finding | Treatment |
|---|---|---|
| P3-01 | Design tokens are not fully centralized. | Consolidate incrementally when touched; avoid a broad visual rewrite. |
| P3-02 | Remaining explicit `any` and legacy warning debt raises maintenance cost. | Reduce during domain refactors without blocking beta. |
| P3-03 | Further interaction-only chunk splitting opportunities remain. | Use measured artifacts and browser coverage before changing loading boundaries.[3] |

## Deployment checklist

### Before publishing

| Check | Required evidence |
|---|---|
| Release candidate | A recoverable checkpoint containing claim-integrity fixes, report, tests, and zero TypeScript errors. |
| Content integrity | Source and desktop/mobile browser tests prove no testimonials, reviewer identities, star rating, or fallback count floors remain. |
| CI provenance | GitHub `main` contains the active `.github/workflows/ci.yml`; its preserved template remains documented for restricted-token recovery. |
| CI result | Run `32916972360` passed TypeScript, ESLint, internal links, 6,770 deterministic unit/integration tests, the production build, and bundle budgets on the same SHA.[10] |
| Environment | Required auth, email, storage, VAPID, analytics, Sentry, and Stripe secrets are present in production without exposing values. |
| Database | The additive RSVP manual-payment migration is applied. Confirm health, a read-only public stats query, and the three privacy-safe payment columns before publish. |
| Monetization mode | If P1-03 is open, keep paid acquisition and Pro checkout promotion disabled. |

### Immediately after publishing

| Check | Pass condition |
|---|---|
| Health | `/api/health` returns HTTP 200 with `status: ok`.[4] |
| Landing | No testimonial cards, reviewer identities, `Avg. Host Rating`, or inflated fallback counts appear. |
| Acquisition | Host Tournament, Join Tournament, Clubs, Tools, Pricing, Terms, and the live demo routes resolve without console errors. |
| Tournament core | Create a test tournament, refresh mid-wizard, complete creation, open the event page, join, record a result, refresh Director, and verify persistence. |
| Club core | Open club creation, refresh mid-wizard, complete a test club, and verify Feed/Events navigation. |
| RSVP core | Edit a test form, interrupt the save, refresh, verify recovered edits, then confirm a successful sync clears the local recovery draft. |
| Observability | Verify one client metric and one server request/error record arrive without user, tournament, club, query, or hash identifiers.[7] [8] |

### First 24 hours

Use a small beta cohort. Review health, structured errors, Web Vitals ratings, SSE disconnect frequency, recovery latency, API 5xx rates, and support reports at least twice. Pause acquisition if a P0 defect appears, if error rate increases materially, or if tournament state cannot be recovered reliably.

## Rollback plan

This release includes an additive, nullable RSVP manual-payment migration. A code rollback may leave the three payment-status columns in place safely; do not drop columns during an incident. The safest rollback target for future releases is the content-integrity release candidate represented by this report’s checkpoint, not an older checkpoint that reintroduces unverifiable landing claims.

| Step | Action | Verification |
|---|---|---|
| 1 | Pause marketing and paid acquisition. Preserve logs and affected request IDs. | New traffic is controlled; evidence remains available. |
| 2 | Use Version History in the Management UI to roll back to this report’s verified content-integrity checkpoint. | Deployment reports healthy and the checkpoint version is active. |
| 3 | Re-run `/api/health`, landing content-integrity checks, Join, Director result persistence, club navigation, and RSVP recovery. | All critical smoke checks pass. |
| 4 | Confirm no old testimonials, rating claim, or fallback floors returned with the rollback. | Landing claim-integrity browser check passes. |
| 5 | Resume the beta cohort only after the root cause and forward fix have their own tests and checkpoint. | No repeated incident in focused regression. |

If an emergency requires reverting to a checkpoint older than this report, keep the site out of marketing circulation until the content-integrity removals are reapplied and verified.

## Final recommendation

ChessOTB is ready for **controlled free-beta onboarding after the current release candidate is published and smoke-tested**. The architecture and regression posture are sufficient for learning with a limited cohort. It is **not ready for broad paid acquisition** until the published content-integrity correction, Stripe lifecycle verification, and a passing load baseline are complete.

This is a conditional operating decision, not a claim that every backlog item is complete. The immediate sequence is: publish the content-integrity release candidate, complete the post-publish smoke matrix, and then begin a small free-beta cohort.

## References

[1]: ./todo.md "ChessOTB verified QA and backlog ledger"
[2]: ./docs/CI_WORKFLOW_TEMPLATE.yml "Preserved ChessOTB continuous integration workflow template"
[3]: ./docs/BUNDLE_AUDIT.md "ChessOTB bundle audit and performance budgets"
[4]: https://chessotb.club/api/health "ChessOTB production health endpoint"
[5]: https://github.com/arnoldlo619/otbchess2.0 "Connected ChessOTB GitHub repository"
[6]: ./PLATFORM_AUDIT_2026-08-21.md "ChessOTB platform architecture and security audit"
[7]: ./client/src/lib/operationalTelemetry.ts "Privacy-safe client operational telemetry"
[8]: ./server/operationalMetricsRoutes.ts "Rate-limited operational metrics endpoint"
[9]: ./tests/landing-social-proof-integrity.test.ts "Landing social-proof and platform-stat integrity contract"
[10]: https://github.com/arnoldlo619/otbchess2.0/actions/runs/32916972360 "GitHub Actions Quality Gates run 32916972360"
[11]: ./docs/PRODUCTION_LOAD_BASELINE_2026-08-26.md "Authorized staged production load baseline"
