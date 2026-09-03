# Bound inventory ledger quantity magnitude (2026-09-03)

## Completed
- Cap `inventory_events.quantity` at absolute magnitude `1_000_000` via table CHECK and BEFORE INSERT trigger so every write path (RPC, count approval, outbox) rejects oversized quantities.
- Mirror the same ceiling in domain `acceptInventoryEvent` (`quantity_too_large`) and shared `INVENTORY_EVENT_QUANTITY_MAX` / `operatingLimits.inventoryQuantity`.
- Add pgTAP + static migration pins so oversized direct RPC evidence fails closed.

## Why
Client validation already bounded quantities at 1_000_000, but authenticated ledger insert paths only rejected null/sign mismatches. With canonical-unit conversion, a direct caller could store hundreds of millions of grams while native on-hand stayed inside the projection ceiling; retained (`projection_applied = false`) rows skipped that ceiling entirely. Same integrity class as #368/#370 evidence bounds; deliberately does not redeclare `record_inventory_event` so it composes with those stacks.

## Verification
- `npm run typecheck`
- focused: `inventoryLedger`, `inventoryEventQuantityMagnitudeMigration`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` (Docker-dependent)

## Notes
- Expect rebase vs #367/#368/#370 on `inventory_event_ledger.test.sql` plan count.
- Additive migration `20260903090000_bound_inventory_event_quantity_magnitude.sql` must be deployed before hosted use.
