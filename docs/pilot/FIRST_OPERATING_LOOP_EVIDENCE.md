# First operating loop evidence

Candidate commit: `NOT YET RECORDED`  
Environment: isolated worktree; local repository and ephemeral PostgreSQL verification
Date: 2026-08-15

| Stage | Result | Evidence |
| --- | --- | --- |
| UI reference baseline | PASS | Envelope-safety PR #129 merged; source-truth branch starts at `312c6f13a7d9d405ddfcad6eb7260020c3f54bb1` |
| TypeScript typecheck | PASS | `npm run typecheck` |
| Unit/integration tests | PASS | `npm test` — 519 pass, 0 fail |
| Static security | PASS | `npm run security:static` |
| Backend security | PASS | `npm run security:backend` |
| Static design | PASS | `npm run design:static` |
| Route smoke | PASS | `npm run qa:routes` |
| Mobile layout | PASS | `npm run qa:mobile-layout` plus Browser QA at 390 × 844, 375 × 812, and 320 × 812; no horizontal overflow on required routes |
| Localized interactions | PASS | `npm run qa:interactions`; core flow, Spanish, Simplified Chinese, Ask Mise |
| Square OAuth | NOT RUN | Square Sandbox credentials were not used in this run |
| Square catalog | NOT RUN | External credential required |
| Square sales sync | NOT RUN | External credential required |
| Migration chain | PASS | Every migration applied in order to an ephemeral PostgreSQL 18 cluster with Supabase auth/Vault primitives stubbed only for local parsing |
| Database replay/approval proof | NOT RUN | Docker is absent, Postgres.app lacks pgTAP, and the configured hosted project is unavailable through the CLI link/pooler; pgTAP sources are present but unexecuted |
| Inventory count | NOT RUN | No hosted pilot restaurant was mutated |
| Recipe consumption | PASS | Deterministic domain tests cover mapped sale-to-ingredient depletion |
| Pilot readiness contract | PASS | Pure domain tests cover complete evidence, missing counts, weighted recipe gaps, external Gmail, and tenant mismatch |
| Recommendation generation | PASS | Count freshness, post-count depletion, complete Square identity, verified recipe chain, and provenance tests pass |
| Supplier grouping and draft | PASS | Recommendation workflow tests prove tenant/supplier grouping and replay safety |
| Manager approval | PASS | Role/workflow tests cover owner/admin/manager approval and staff denial; the supplier envelope RPC is authenticated-only and manager-gated |
| Recipient-visible review | PASS | Order detail loads exact From, To, and Subject; approval persists that tuple, and the provider claim rechecks it under row locks before delivery |
| Gmail OAuth | NOT RUN | Google OAuth credential required |
| Gmail controlled send | NOT RUN | Authorized test sender/recipient and live gate required |
| Duplicate-send protection | PASS | Static/domain/migration tests cover stable claim, in-progress, already-sent, and unknown outcomes |
| Order/recommendation final state | PASS | Provider-completion workflow tests; no live provider proof |
| Activity history | PARTIAL | Truthful Square import-count migration and static tests pass; full database trigger proof was not run |
| Cross-tenant denial | PARTIAL | Static and pgTAP source coverage pass; database suite not executed in this run |

## Current readiness

`NOT YET READY — CODE GAPS REMAIN`

External provider stages must remain `NOT RUN` until authorized staging credentials and controlled destinations are available.
The database pgTAP proof must remain `NOT RUN` until a Docker-capable or reachable hosted Supabase test environment is available. The successful ephemeral PostgreSQL migration apply validates SQL execution, but it does not substitute for Supabase RLS/role tests.
