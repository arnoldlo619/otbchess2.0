# ChessOTB.club Release Decision

**Decision date:** August 25, 2026  
**Scope:** Controlled beta readiness, public marketing readiness, paid-flow readiness, deployment controls, and rollback controls  
**Prepared by:** Manus AI

> **Decision: CONDITIONAL GO for controlled free-beta onboarding. NO-GO for broad paid marketing or paid membership launch until the P0/P1 gates below are closed.**

The current source is materially stronger than the August 21 platform audit. Security hardening, route decomposition, request-correlated error handling, Sentry integration, refresh recovery, Web Vitals, SSE reconnect telemetry, internal-link validation, and bundle-budget enforcement are now present and regression-tested.[1] [2] [3] The live production health endpoint is responding, but release safety is not determined by health alone.[4]

The main blockers are operational rather than architectural. The currently published landing page still contains unverifiable testimonials, a hardcoded host rating, and inflated fallback platform counts. Those claims have been removed in the current source with regression coverage, but the corrected release candidate must be published and verified before any marketing resumes. GitHub `main` now exactly matches the verified local sync commit, while the CI definition remains a preserved template because the connected GitHub App token cannot create workflow files.[2] [5]

## Release posture

| Launch mode | Decision | Conditions |
|---|---|---|
| Internal QA and founder testing | **GO** | Use the current release-candidate checkpoint and keep production writes controlled. |
| Small free-beta cohort | **CONDITIONAL GO** | Publish the claim-integrity fix, complete the smoke checklist, and monitor error, Web Vitals, and SSE telemetry. |
| Broad public marketing | **NO-GO** | First close P0-01 and P1-01/P1-02 so production content and build provenance are verifiable. |
| Paid Pro membership launch | **NO-GO** | First complete the full Stripe checkout, webhook, cancellation, and success-page production flow. |
| Large-event or high-concurrency promotion | **NO-GO** | First establish a production-like load baseline and confirm Autoscale latency/error behavior. |

## Evidence snapshot

| Area | Current evidence | Assessment |
|---|---|---|
| Application routing | 72 route declarations and 64 lazy page modules in `App.tsx`; canonical route and internal-link contracts run in CI.[1] | Strong |
| Unit regression baseline | The latest completed full client baseline records 6,204 passing tests; the repository currently contains 331 unit/integration test files.[1] | Strong, with focused post-baseline additions |
| Browser regression | 24 Playwright specification files cover representative tournament, community, training, marketing, accessibility, resilience, performance, and telemetry flows.[1] | Strong for current stage |
| Type safety and lint | TypeScript and zero-error lint are explicit CI gates and have passed across the recent checkpoint batches.[1] [2] | Strong |
| Production build | A build job and post-build bundle budget are preserved as a CI template, but the current release SHA has not completed that workflow because the connected token cannot create GitHub workflow files. One controlled local attempt on 2026-08-25, after releasing stale Chromium processes with a 3 GiB V8 ceiling, was sandbox-terminated with exit 143 during Vite transforms before artifact output.[2] [5] | Release gate |
| Bundle control | Documented ceilings enforce 2.20 MiB total JS gzip, 210 KiB largest JS gzip, and 525 KiB largest raw CSS after a production build.[3] | Strong once CI runs remotely |
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
| P1-01 | GitHub source parity is restored at commit `6636113a`, but the connected GitHub App token cannot create `.github/workflows/ci.yml`; GitHub rejected the workflow-preserving push. The CI definition is preserved under `docs/` for owner-authorized activation. | CI is documented but not active, so release provenance remains incomplete. | Activate the preserved template through the GitHub web editor or reconnect a credential with workflow permission, then verify the workflow is registered. |
| P1-02 | The latest production build and new bundle-budget gate have not completed on the current remote SHA. | Source-level and focused tests cannot prove the deploy artifact compiles within budget. | Run the remote CI pipeline and require TypeScript, lint, link validation, unit tests, build, and bundle budget to pass. |
| P1-03 | Stripe checkout, successful subscription webhook, cancellation webhook, and `/pro/success` polling remain unverified end to end in production. | Users could pay without entitlement updates or receive inconsistent membership state. | Keep paid acquisition disabled until all four production scenarios pass with test accounts and auditable Stripe events. |
| P1-04 | No production-like load baseline exists for live tournament/SSE traffic. | Large promoted events may expose cold-start, connection, or database limits that functional tests do not measure. | Run a staged load test before advertising large events; define acceptable P95 latency, error rate, and SSE recovery targets. |

### P2: address during controlled beta

| ID | Finding | Treatment |
|---|---|---|
| P2-01 | `ChessnutProAdapter.tsx` still documents incomplete vendor BLE parsing/notification behavior. | Keep the integration explicitly beta and preserve manual move entry; do not market automatic Chessnut Pro support as complete. |
| P2-02 | Large modules remain, including `server/index.ts`, Director, and Club Dashboard. | Continue extraction by domain while preserving route and browser regressions; this is a maintainability risk, not a launch blocker. |
| P2-03 | Global content/design checklist items remain open, including labels, contrast, capitalization, placeholder review, and League demo polish. | Close route by route during beta. Do not claim platform-wide completion until audited. |
| P2-04 | Autoscale cold-start and sustained-event behavior have observability but not a measured capacity envelope. | Monitor the beta cohort and define the threshold for Reserved hosting before high-concurrency promotion. |

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
| CI provenance | GitHub `main` matches the release candidate, then an owner-authorized credential activates `.github/workflows/ci.yml` from the preserved template. |
| CI result | TypeScript, ESLint, internal links, unit tests, production build, and bundle budgets all pass on the same SHA.[2] |
| Environment | Required auth, email, storage, VAPID, analytics, Sentry, and Stripe secrets are present in production without exposing values. |
| Database | No pending schema change exists for this release; confirm health and a read-only public stats query before publish. |
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

This release contains no database migration, so rollback is code-only unless a separate production action changes data. The safest rollback target for future releases is the content-integrity release candidate represented by this report’s checkpoint, not an older checkpoint that reintroduces unverifiable landing claims.

| Step | Action | Verification |
|---|---|---|
| 1 | Pause marketing and paid acquisition. Preserve logs and affected request IDs. | New traffic is controlled; evidence remains available. |
| 2 | Use Version History in the Management UI to roll back to this report’s verified content-integrity checkpoint. | Deployment reports healthy and the checkpoint version is active. |
| 3 | Re-run `/api/health`, landing content-integrity checks, Join, Director result persistence, club navigation, and RSVP recovery. | All critical smoke checks pass. |
| 4 | Confirm no old testimonials, rating claim, or fallback floors returned with the rollback. | Landing claim-integrity browser check passes. |
| 5 | Resume the beta cohort only after the root cause and forward fix have their own tests and checkpoint. | No repeated incident in focused regression. |

If an emergency requires reverting to a checkpoint older than this report, keep the site out of marketing circulation until the content-integrity removals are reapplied and verified.

## Final recommendation

ChessOTB is ready for **controlled free-beta onboarding after the current release candidate is published and smoke-tested**. The architecture and regression posture are sufficient for learning with a limited cohort. It is **not ready for broad paid acquisition** until GitHub/CI provenance, a current production build, Stripe lifecycle verification, and a load baseline are complete.

This is a conditional operating decision, not a claim that every backlog item is complete. The immediate sequence is: publish the content-integrity release candidate, activate the preserved GitHub workflow, obtain a green CI build on the same SHA, complete the post-publish smoke matrix, and then begin a small free-beta cohort.

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
