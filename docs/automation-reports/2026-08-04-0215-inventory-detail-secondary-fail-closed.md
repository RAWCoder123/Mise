# Inventory detail secondary load fail-closed (2026-08-04)

## Gap
`/inventory/[id]` converted secondary `fetchInventoryMovements`, `fetchStorageLocations`, and `fetchInventoryLocationBalances` failures into empty arrays. Operators saw empty history / missing stations instead of a load failure, and waste or transfer could proceed without station context.

## Change
- Presentation helpers distinguish secondary load `ready` / `empty` / `unavailable` and block station actions when locations are unavailable.
- Inventory detail captures `load_movements`, `load_storage_locations`, and `load_location_balances` failures, keeps the item outlook available, shows localized RetryNotice sections, and gates waste/transfer when stations cannot load.
- EN / ES / zh-Hans copy under `inventory.detail.movements|locations|balances.unavailable.*` plus mutation notice `locationsUnavailable`.
- Tests cover helpers, catalog coverage, and removal of the silent `.catch(() => [])` fallbacks.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
