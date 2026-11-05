# Reject zero-quantity inventory ledger movements (2026-11-05)

## Summary

Inventory ledger movements other than count and stockout must change on-hand quantity. Zero-quantity receipt, waste, usage, adjustment, transfer, and correction rows are rejected in domain accept and by an additive BEFORE INSERT trigger so noop history cannot pollute the append-only ledger.

## Changes

- Domain `acceptInventoryEvent` returns `zero_quantity_not_allowed` for zero-quantity non-count/non-stockout events
- Transport maps the hosted exception to the same terminal reason (ahead of the generic quantity matcher)
- Additive migration `20261105200000_reject_zero_quantity_inventory_events.sql` with NOT VALID CHECK + BEFORE INSERT trigger
- Dedicated pgTAP + static migration pins
- Does not redeclare `record_inventory_event`; zero counts and explicit stockouts remain valid

## Why

Operator validation already blocked zero receipt/waste in some UI paths, but hosted RPC, outbox, and demo accept still allowed quantity = 0 for movement types. Those rows do not move on-hand yet waste idempotency keys, activity, and waste analysis. Fresh tip re-evaluates historical #374 against current `origin/main` (MISE-005A) with a post-004C migration timestamp.

## Verification

- `npm run typecheck`
- Focused ledger / transport / migration tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- pgTAP source at `supabase/tests/database/inventory_event_zero_quantity.test.sql`

## Deploy

Apply additive migration `20261105200000_reject_zero_quantity_inventory_events.sql` before relying on hosted zero-quantity rejection.
