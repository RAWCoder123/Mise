# Inventory hub loading + detail retry polish (2026-08-02)

## Gap
Inventory hub always full-screen loaded on focus and treated unloaded/failed health and stock lists as empty:
- First-load failures flashed “No items” / “No inventory matches” beside RetryNotice.
- Inventory item detail load failures showed plain error text with no retry control.

## Change
- Soft-refresh hub load (Orders/Settings pattern): full-screen loading only for first paint / restaurant switch.
- `services/presentation/inventoryHubPresentation.ts` keeps loading/error copy distinct from true empty stock.
- Inventory detail uses `RetryNotice` for load failures.
- i18n: EN / ES / zh-Hans keys for health/list loading/unavailable and detail retry.

## Verification
- `npm run typecheck`
- `npm test` — 403 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-1159` (FF from `48f9` tip + this work)
