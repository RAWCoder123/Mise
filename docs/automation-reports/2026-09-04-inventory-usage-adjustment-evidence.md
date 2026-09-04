# Usage / adjustment ledger evidence authority (2026-09-04)

## Summary

Require allowlisted `reason_code` and a non-empty `metadata.note` for inventory
`usage` and `adjustment` ledger events at both the domain and database
boundaries.

## Why

Hosted `record_inventory_event` already accepts `usage` and `adjustment` for
owner/admin/manager. Projection subtracts usage and applies adjustments as
signed deltas. Without bounded evidence, a manager JWT could rewrite on-hand
under those semantics with no comparable audit taxonomy.

Product writers (#365 usage UI, #348 adjustment UI) already stamp allowlisted
reasons and a required note. This closes the hosted fail-closed gap those
stacks intentionally left to a migration.

## What changed

- `services/domain/inventoryUsageAdjustmentEvidence.ts` — allowlists + note helper
- `services/domain/inventoryLedger.ts` — reject incomplete usage/adjustment evidence
- Additive migration `20260904140000_inventory_usage_adjustment_evidence.sql`
  — BEFORE INSERT trigger + NOT VALID reason CHECKs (does not rewrite history;
  does not replace `record_inventory_event`)
- Domain, migration-pin, and dedicated pgTAP coverage
- Existing ledger projection fixture updated to carry valid usage evidence

## Non-goals

- On-hand floor preflight for usage/decreasing adjustments (depends on #383)
- Client UI / `miseValidation` / i18n (owned by #365/#348)
- Waste/stockout reason DB allowlists (depends on #301/#366)
- Inventing MOQ / lead time / expiration fields

## Verification

- `npm run typecheck`
- focused unit/pin tests + `npm test`
- `npm run security:static` / `npm run security:backend` when available
- `npm run supabase:test` blocked without Docker in this environment

## Classification impact

Controlled pilot integrity hardening. Does not change App Store / founder blockers.
