# Hub actions fail-closed port (2026-08-10)

Branch: `cursor/mise-product-inspection-824d`  
Base tip: `cursor/mise-product-inspection-f2c9` / `integration/mise-current` security tip

## Gap

Design-rebuild hubs muted cross-restaurant stale rows via `loadedRestaurantId`, but soft-refresh `loadError` left role-derived mutations interactive (Team invite/role/remove, Suppliers save, Settings restaurant rows/export/demo restore, Orders approve/send, Insights refresh/feedback, Recipes, Gmail, inventory/order detail).

## Fix

1. Added `services/presentation/hubLoadState.ts` with:
   - `resolveRestaurantScopedHubLoadState` (loadError wins over prior loaded match)
   - `presentRestaurantScopedHubActionsEditable`
2. Wired hub readiness into Today, Inventory, Orders, Insights, Settings, Team, Suppliers, Recipes, Gmail, inventory detail, and order detail.
3. Added `OperationalRow.disabled` for Settings restaurant-scoped navigation muting.
4. Removed Inventory list hard-cap of 12 rows.
5. Pinned contracts in `tests/hubLoadState.test.ts` and `tests/clientTenantSafety.test.ts`.

## Verification

- `npm run typecheck` — pass
- `npm test` — 475 pass / 0 fail (7 pre-existing recalculation timeout tests cancelled by pending timers)
- `npm run security:static` — pass
- `npm run security:backend` — pass
- `npm run design:static` — pass
- `npm run qa:routes` — pass

## Next

- Route hosted inventory counts through append-only `record_inventory_event` ledger.
- Hosted/Docker security re-proof.
- Founder Auth redirect allowlist + privacy/support/terms HTTPS URLs.
