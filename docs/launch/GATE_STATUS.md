# Mise Release Gate Status

Updated: 2026-07-28

| Gate | Status | Current evidence | Remaining blockers |
| --- | --- | --- | --- |
| 1. Private-beta foundation | In progress | Expo dependency repair, tenant security migrations, deterministic demo mode, team roles, hosted account-deletion proof, owner/admin restaurant export, complete hosted two-tenant and rendered race proof, scrubbed observability contracts, operational restore evidence, incident runbooks, and enforced read-only/emergency modes | Live Sentry/PostHog receipt and alert rules, managed hosted recovery, monitored privacy/support address, internal TestFlight |
| 2. Inventory truth | Beta scope complete; UI/device proof pending | Effective-dated mapping schema/domain rules, verified conversions, append-only ledger, event-derived on-hand projection, replay-safe RPC/outbox, count reconciliation, daily CSV import, mobile count/receipt/waste/stockout workflows, hosted learning proof, deterministic evidence-backed daily findings, and append-only manager feedback | Surface the daily brief and feedback controls; real-device inventory/offline walkthrough; package mappings remain fail-closed until verified |
| 3. Square shadow mode | Not started | Fail-closed POS adapter scaffold | OAuth, webhooks, backfill, reconciliation, shadow evidence |
| 4. Operational pilot | Not started | Default-off order safety evaluator and manager-controlled email workflow | Persisted policy, scheduler, pilot evidence |
| 5. Commercial and App Store launch | Not started | Paid-readiness and TestFlight checklists | Savings evidence, billing approval, privacy/deletion, App Store submission |

## Gate policy

A later gate may be developed behind disabled controls, but it cannot be activated
until every preceding gate has documented evidence and no unresolved P0 or P1 issue.

## Current beta evidence

- `npm run typecheck`
- `npm test`: 282 passed
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:interactions`: passed at 390x844 in English, Spanish, and
  Simplified Chinese
- `npm run supabase:test`: 530 pgTAP assertions, bounded concurrency proof,
  and no local security-advisor findings
- `npm run verify:private-beta-security:hosted`: passed without skipped checks
- `npm run staging:learning-check`: a bounded 30 lb recommendation learned the
  manager-approved 40 lb median without crossing tenants or sending an order
- Hosted account deletion deleted only its disposable tenant and left durable
  cleanup evidence.
- Hosted restaurant export returned 25 tenant-scoped datasets, denied manager
  and cross-tenant access, and excluded credentials and private security logs.
- Hosted finding feedback denied staff, direct-DML, cross-tenant, changed
  replay, and evidence-poisoning attempts while preserving one auditable
  manager decision.
- Staging migrations confirmed through
  `20260728194253_harden_operational_finding_evidence.sql`

Remaining external verification:

- Install and walk the critical workflow on real supported iPhones.
- Install/select full Xcode so `simctl` and native prerequisite checks can run.
- Complete live monitoring, managed Supabase recovery, and TestFlight evidence.
