# Setup recipe inventory picker (2026-08-02)

## Gap
Onboarding recipe mapping still required near-exact inventory names (`.toLowerCase()` only). Near-misses silently created orphan “Recipe baseline” SKUs, splitting counts and forecasts.

## Change
- Domain: `services/domain/setupRecipeLinking.ts` reuses ranked inventory search/resolve for setup drafts.
- Persistence: `saveRestaurantSetup` keys inventory by `inventoryItemNameKey`, resolves ingredients via picker helpers (draft id → unique ranked match → catalog), and writes canonical `linkedInventoryItem.item_name`.
- UI: `/setup` recipe step shows search chips against prior-step inventory, stores `inventoryItemId`, and syncs units on selection.
- i18n: EN / ES / zh-Hans picker state copy.
- Tests: `tests/setupRecipeLinking.test.ts` + security static contract.

## Proof
- `npm run typecheck`
- `npm test` (355 pass)
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` still unavailable in this environment.

## Follow-ups
- Optional: reuse picker helpers on Inventory list / count search.
- Docker/hosted re-proof after July/Aug migrations.
