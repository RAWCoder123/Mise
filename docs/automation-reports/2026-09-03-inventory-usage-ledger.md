# Inventory usage ledger (2026-09-03)

## Summary
Managers can append positive `usage` ledger events from More → Record usage for known non-waste consumption (prep, staff meal, tasting, training, other) with a required note.

## Why
Hosted `record_inventory_event` already accepts `usage` for owner/admin/manager and projects it as a decrease, but the client operator boundary only allowed count/receipt/waste/stockout. Operators had to mislabel prep draw-downs as waste or approximate with full counts.

## Scope
- Domain reason codes + `requireInventoryUsage` / `queueInventoryUsage`
- Fail-closed More hub screen with restaurant-switch guards
- EN/ES/zh-Hans copy, route smoke, tenant/hub safety pins
- Does not edit contested `app/inventory/[id].tsx`
- Does not implement signed adjustments (#348) or waste correction
- No migration (existing ledger contract already allows usage)

## Verification
- `npm run typecheck`
- Targeted usage suites + `npm test`
- `npm run security:static`
- `npm run design:static`
