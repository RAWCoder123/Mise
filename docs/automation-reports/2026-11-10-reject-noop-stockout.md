# Reject no-op inventory stockouts (2026-11-10)

## Problem

Stockout ledger rows always post `quantity = 0` and project on-hand to zero. When `inventory_items.current_quantity` is already zero, a second stockout appends a no-op history row, wastes idempotency keys, and confuses activity/audit trails.

## Change

- Domain: `rejectNoOpStockoutReason` / `NOOP_STOCKOUT_MESSAGE` in `services/domain/stockoutNoOpGuard.ts`
- Demo: `recordInventoryEvent` returns terminal `{ status: "rejected", reason: "noop_stockout" }` so the device outbox settles instead of retrying
- Transport: hosted `22023` message maps to `noop_stockout` ahead of the generic quantity matcher
- Hosted: additive BEFORE INSERT trigger `private.reject_noop_stockout_inventory_event` (does not redeclare `record_inventory_event`)

## Out of scope

- Stockout confirmation UI (#389)
- Structured stockout reason codes (#366)
- Server-stamp prior on-hand metadata (#391)
- Zero-quantity non-stockout movement rejection (#1119/#374)
- Inventory detail UI / i18n preflight (flush already surfaces the rejection message)

## Verification

- Focused: `tests/stockoutNoOpGuard.test.ts`, `tests/inventoryEventNoopStockoutMigration.test.ts`, `tests/inventoryEventTransport.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
