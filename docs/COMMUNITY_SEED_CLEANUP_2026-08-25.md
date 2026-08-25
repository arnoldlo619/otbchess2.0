# Community Seed Cleanup — 2026-08-25

## Scope

ChessOTB previously populated production club surfaces with legacy browser seed records and exposed an owner/director control that injected demo members with synthetic activity. The project database also contained ten clubs owned by the sentinel account `seed`, plus two linked membership rows and one linked RSVP row.

## Remediation

The club and event registry entry points now keep legacy demo seeding disabled. On load, they idempotently remove only records tied to `seed-club-*`, `seed-m*`, or `demo_*` identifiers while preserving all other local clubs, members, tournaments, follows, events, RSVPs, and comments. The Club Dashboard no longer exposes the demo-member injection control.

The project database cleanup ran in one transaction. It removed linked records first across all tables containing `club_id`, then deleted only clubs satisfying both `owner_id = 'seed'` and `id LIKE 'seed-club-%'`. Post-cleanup verification returned zero matching clubs, members, or RSVPs.

## Verified Database Records Removed

| Record Type | Count | Identification Rule |
|---|---:|---|
| Clubs | 10 | `owner_id = 'seed'` and `id LIKE 'seed-club-%'` |
| Club memberships | 2 | `club_id` matched a confirmed seed club |
| Club-event RSVPs | 1 | `club_id` matched a confirmed seed club |
| Other club-linked tables | 0 | Audited across all 18 tables containing `club_id` |

## Validation

The migration unit suite proves a fresh browser receives no seeded clubs or events, legacy records are removed, real local records remain, and repeated cleanup is idempotent. Repository contracts keep seeding disabled, prevent the demo-member control from returning, and reject Quads fixtures labeled as Swiss. Desktop and mobile browser coverage verifies the Clubs page removes injected legacy records while preserving real local data, and the existing real public-club discovery/profile flows continue to pass.
