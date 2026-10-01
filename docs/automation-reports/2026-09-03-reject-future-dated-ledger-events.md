# Reject future-dated inventory ledger events

## Summary

Non-count inventory ledger rows (receipt, waste, usage, adjustment, transfer, stockout, correction) can no longer be effective more than two minutes ahead of the server clock. Counts already had this guard; the same skew now applies to every `inventory_events` type so a fast device clock cannot silently inflate or drain on-hand.

## Changes

- Domain: `services/domain/inventoryLedger.ts` rejects future-dated non-count events with `future_dated_event` (counts keep `future_dated_count`).
- Migration: `supabase/migrations/20260903120000_reject_future_dated_inventory_events.sql` broadens the BEFORE INSERT trigger.
- Comment parity: `services/domain/inventoryCountAuthority.ts`.
- Tests: domain coverage in `tests/inventoryLedger.test.ts`; authoritative count suite updated; migration pin; pgTAP assertions in `inventory_event_ledger.test.sql`.

## Verification

- `npm run typecheck`
- `npm test` (targeted + full suite)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Out of scope

- Inventing MOQ / lead_time / expiration
- Contested Home / operatingBrief fail-closed stacks
- Hosted Docker pgTAP execution in this environment (assertions added for when the harness runs)
