# Inventory count + detail soft-refresh polish (2026-08-03)

## Gap
- `/inventory/count` full-screen loaded on every focus and treated an unloaded/failed session as “Start a count session”.
- `/inventory/[id]` always hard-loaded, cleared prior item data on soft-refresh failure, and only surfaced RetryNotice when the item was already gone.

## Change
- Soft-refresh count load (hub pattern): Screen loading only for first paint / restaurant switch; focus uses `load(false)`.
- Soft-refresh detail load keeps prior outlook/movements/locations after retry failures for the same restaurant + item.
- `services/presentation/inventoryCountPresentation.ts` and `inventoryDetailPresentation.ts` keep loading/error copy distinct from true empty/start/not-found states.
- EN / ES / zh-Hans catalog keys for count start loading/unavailable and detail loading/unavailable.
- Tenant-safety gates require `hubReady` + presentation helpers on both screens.

## Verification
- `npm run typecheck`
- `npm test` — 425 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-672b` (FF from `bd08` tip + this work)
