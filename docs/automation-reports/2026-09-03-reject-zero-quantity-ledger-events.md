# Reject zero-quantity inventory ledger movements (2026-09-03)

## Summary

Server and domain now reject `quantity = 0` for receipt, waste, usage, adjustment, transfer, and correction inventory ledger events. Count may still observe zero on hand; stockout remains an explicit zero.

## Why

Operator validation already blocked zero receipt/waste. Hosted RPC, outbox, and demo `acceptInventoryEvent` still appended noop rows that polluted append-only history without moving on-hand.

## Changes

- Domain `validateEventInput` → `zero_quantity_not_allowed`
- Transport maps the hosted exception to the same terminal rejection
- Additive migration `20260903170000_reject_zero_quantity_inventory_events.sql`
  - BEFORE INSERT trigger on every write path (no `record_inventory_event` redeclaration)
  - CHECK `inventory_events_nonzero_movement_check` added `NOT VALID`
- Dedicated pgTAP `inventory_event_zero_quantity.test.sql` (avoids contested ledger plan file)

## Verification

- `npm run typecheck`
- focused: `inventoryLedger`, `inventoryEventZeroQuantityMigration`, `inventoryEventTransport`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` blocked locally when Docker unavailable

## Notes

- Deploy additive migration before hosted use
- Composes with open ledger stacks #367–#373 (does not redeclare RPC)
- Do not invent MOQ / lead_time / expiration
