# First operating loop evidence

Candidate commit: `NOT YET RECORDED`  
Environment: local repository verification only  
Date: 2026-08-14

| Stage | Result | Evidence |
| --- | --- | --- |
| UI reference baseline | PASS | PR #127 merged; `origin/main` = `e3d9f3472ecd90fa0a8392fb9a71c5cb5ff1d1ec` |
| TypeScript typecheck | PASS | `npm run typecheck` |
| Unit/integration tests | PASS | `npm test` — 508 pass, 0 fail |
| Static security | PASS | `npm run security:static` |
| Backend security | PASS | `npm run security:backend` |
| Static design | PASS | `npm run design:static` |
| Route smoke | PASS | `npm run qa:routes` |
| Mobile layout | PASS | `npm run qa:mobile-layout`; 390 × 844; no horizontal overflow on tested routes |
| Localized interactions | PASS | `npm run qa:interactions`; core flow, Spanish, Simplified Chinese, Ask Mise |
| Square OAuth | NOT RUN | Square Sandbox credentials were not used in this run |
| Square catalog | NOT RUN | External credential required |
| Square sales sync | NOT RUN | External credential required |
| Database replay/approval proof | BLOCKED | `npm run supabase:test` exited 1 because the Docker socket is absent; Square overlap/replay and supplier-envelope pgTAP sources remain unexecuted |
| Inventory count | NOT RUN | No hosted pilot restaurant was mutated |
| Recipe consumption | PASS | Deterministic domain tests cover mapped sale-to-ingredient depletion |
| Pilot readiness contract | PASS | Pure domain tests cover complete evidence, missing counts, weighted recipe gaps, external Gmail, and tenant mismatch |
| Recommendation generation | PARTIAL | Deterministic domain tests pass; readiness is reported but not yet enforced in approval/drafting |
| Supplier grouping and draft | PASS | Recommendation workflow tests prove tenant/supplier grouping and replay safety |
| Manager approval | PASS | Role/workflow tests cover owner/admin/manager approval and staff denial; the supplier envelope RPC is authenticated-only and manager-gated |
| Recipient-visible review | PASS | Order detail loads exact From, To, and Subject; approval persists that tuple, and the provider claim rechecks it under row locks before delivery |
| Gmail OAuth | NOT RUN | Google OAuth credential required |
| Gmail controlled send | NOT RUN | Authorized test sender/recipient and live gate required |
| Duplicate-send protection | PASS | Static/domain/migration tests cover stable claim, in-progress, already-sent, and unknown outcomes |
| Order/recommendation final state | PASS | Provider-completion workflow tests; no live provider proof |
| Activity history | PARTIAL | Truthful Square import-count migration and static tests pass; full database trigger proof was not run |
| Cross-tenant denial | PARTIAL | Static and source pgTAP coverage pass; database suite not executed in this run |

## Current readiness

`NOT YET READY — CODE GAPS REMAIN`

External provider stages must remain `NOT RUN` until authorized staging credentials and controlled destinations are available.
The database proof must remain `BLOCKED` until a Docker-capable or hosted Supabase test environment is available; the wrapper command's zero exit does not override its explicit `supabase db start failed` output.
