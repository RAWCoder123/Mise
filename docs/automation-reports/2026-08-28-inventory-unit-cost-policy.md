# Inventory estimated unit cost policy edit (2026-08-28)

## Gap
Order automation blocks on `missing_unit_cost`, but day-2 inventory detail only
allowed par/reorder patches. Managers could not correct zero or stale unit costs
without reopening setup. On-hand quantity remained correctly ledger-only.

## Change
- Additive migration extends `private.service_update_inventory_and_signals` to
  accept `estimated_unit_cost` alongside par/reorder (0..1_000_000).
- Edge `requireInventoryPatch` allowlist matches the SQL tip.
- Client `InventoryItemPatch`, validation, inventory detail UI, and EN/ES/zh-Hans
  copy save estimated unit cost with the existing settings form.
- Tests pin tip allowlists, UI contract, validation, and pgTAP assertions.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`

## Classification
Controlled pilot-ready for demo + service-owned hosted path once the additive
migration is deployed. Does not invent spend facts; zero cost still surfaces as
order-automation incomplete until a positive estimate is saved.
