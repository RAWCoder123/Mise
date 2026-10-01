# Retire direct operator counts on inventory detail (2026-09-04)

Tip: `cursor/mise-retire-operator-count-detail`
Base: `origin/main` @ `20b28e5`

## Problem

Inventory detail defaulted to a single-item **Count** action that queued
`operator_count` ledger replaces. Authoritative count evidence is supposed to
come only from audited count-session approval, so detail counts skipped variance
review and session provenance while still overwriting on-hand.

## Fix

- Removed `count` from inventory detail operator actions; default is receive.
- Added a Physical count card that routes managers to `/inventory/count`.
- `requireInventoryOperation` rejects `count` so the device outbox cannot mint
  `operator_count` events from the client boundary.
- Updated EN/ES/zh-Hans copy for detail ops, list subtitle, and view-only text.
- Count-session approval paths are unchanged.

## Verification

- `npm run typecheck`
- focused pins + validation/outbox tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Follow-ups

- Optional hosted migration to reject non-`approve_count_session` count inserts.
- After #383+#365+#348: on-hand floor preflight for usage / decreasing adjustments.
- Land/rebase open stacks onto main without duplicating gates.
