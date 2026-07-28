# Mise Release Gate Status

Updated: 2026-07-28

| Gate | Status | Current evidence | Remaining blockers |
| --- | --- | --- | --- |
| 1. Private-beta foundation | In progress | Expo dependency repair, tenant security migrations, deterministic demo mode, team roles, hosted account-deletion proof, owner/admin restaurant export, complete hosted two-tenant and rendered race proof, scrubbed observability contracts, operational restore evidence, incident runbooks, enforced read-only/emergency modes, fail-closed exact-commit release authority, and pinned TestFlight tooling | EAS login/project link, full Xcode, live Sentry/PostHog receipts and alerts, managed hosted recovery, monitored privacy/support address, internal TestFlight |
| 2. Inventory truth | Beta scope complete; device proof pending | Effective-dated mapping schema/domain rules, verified conversions, append-only ledger, event-derived on-hand projection, replay-safe RPC/outbox, count reconciliation, daily CSV import, mobile count/receipt/waste/stockout workflows, hosted learning proof, deterministic evidence-backed daily findings, exact append-only manager feedback, restart-safe feedback delivery, and localized operator UI including rendered export | Real-device inventory/offline/share walkthrough; package mappings remain fail-closed until verified |
| 3. Square shadow mode | Not started | Fail-closed POS adapter scaffold | OAuth, webhooks, backfill, reconciliation, shadow evidence |
| 4. Operational pilot | Not started | Default-off order safety evaluator, persisted `off`/`draft_only` policy, tenant/global provider gates, and manager-controlled email workflow | Scheduler, provider activation proof, pilot evidence |
| 5. Commercial and App Store launch | Not started | Paid-readiness and TestFlight checklists | Savings evidence, billing approval, privacy/deletion, App Store submission |

## Gate policy

A later gate may be developed behind disabled controls, but it cannot be activated
until every preceding gate has documented evidence and no unresolved P0 or P1 issue.

## Current beta evidence

- `npm run typecheck`
- `npm test`: 307 passed
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:interactions`: passed at 390x844 in English, Spanish, and
  Simplified Chinese
- `npm run supabase:test`: 547 pgTAP assertions, bounded concurrency proof,
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
- Exact manager feedback now affects only the matching finding evidence and
  policy, keeps handled findings visible in Later, and expires after evidence
  or the original recommendation changes.
- Manager feedback submission now survives app interruption and ambiguous
  transport with the original client and idempotency identities; conflicts and
  permission failures remain visible for reconciliation.
- Staging migrations confirmed through
  `20260728203500_enforce_provider_kill_switches.sql`
- Hosted provider proof confirms every staging tenant is default-off, the
  service role cannot bypass the guarded Gmail claim, and a blocked claim
  creates no delivery evidence.
- `npm run beta:go-no-go` is intentionally blocked until all 12 exact-commit
  receipts, a TestFlight build identity, and Raymond approval are recorded.
- Daily Brief, manager feedback, and owner/admin export UI passed static design
  checks plus rendered English, Spanish, and Simplified Chinese interaction QA.
- `/settings/export` now passes shell and 390x844 rendered coverage. The EAS
  preflight correctly blocks on missing login and project identity.

Remaining external verification:

- Install and walk the critical workflow on real supported iPhones.
- Install/select full Xcode so `simctl` and native prerequisite checks can run.
- Authenticate EAS and link `expo.extra.eas.projectId`.
- Complete live monitoring, managed Supabase recovery, and TestFlight evidence.
