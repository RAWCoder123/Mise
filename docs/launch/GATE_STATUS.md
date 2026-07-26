# Mise Release Gate Status

Updated: 2026-07-26

| Gate | Status | Current evidence | Remaining blockers |
| --- | --- | --- | --- |
| 1. Private-beta foundation | In progress | Expo dependency repair, beta verification scripts, tenant security migrations, demo mode, sign-up, team roles, recoverable in-app account deletion | Hosted staging proof, internal TestFlight, monitoring and restore evidence |
| 2. Inventory truth | In progress | Effective-dated mapping schema/domain rules, canonical units, append-only event ledger, replay-safe manager RPC, durable device outbox/worker, count reconciliation | AsyncStorage composition and screen submission wiring, receiving UI integration |
| 3. Square shadow mode | Not started | Fail-closed POS adapter scaffold | OAuth, webhooks, backfill, reconciliation, shadow evidence |
| 4. Operational pilot | Not started | Default-off order safety evaluator and manager-controlled email workflow | Persisted policy, scheduler, pilot evidence |
| 5. Commercial and App Store launch | Not started | Paid-readiness and TestFlight checklists | Savings evidence, billing approval, privacy/deletion, App Store submission |

## Gate policy

A later gate may be developed behind disabled controls, but it cannot be activated
until every preceding gate has documented evidence and no unresolved P0 or P1 issue.
