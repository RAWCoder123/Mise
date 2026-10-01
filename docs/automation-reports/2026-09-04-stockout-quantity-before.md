# Stockout quantity_before metadata (2026-09-04)

Tip: `cursor/mise-stockout-quantity-before`
Base: `origin/main` @ `20b28e5`

## Problem
Operator stockouts append `quantity = 0` while projection zeros on-hand, so the
wiped amount never became durable ledger evidence. Activity even summarized
stockouts as `0 g…`. Open #366/#389 add reason codes / confirm UI only.

## Fix
- Domain helpers strip/stamp server-owned `quantity_before` + `canonical_quantity_before`
- Demo `recordInventoryEvent` stamps from locked on-hand before projection
- Ledger idempotency compares client-comparable metadata only
- Migration `20260904080000_stockout_quantity_before_metadata.sql`:
  - BEFORE INSERT stamp trigger (overwrites client forgeries)
  - `record_inventory_event` uses comparable-metadata idempotency
  - Activity summary includes prior canonical on-hand
- pgTAP `stockout_quantity_before.test.sql`

## Verification
See commit / PR checks.

## Do not redo
Stockout confirm UI (#389), stockout reason codes (#366), waste/usage/adjust
on-hand preflights (#383/#365/#348).
