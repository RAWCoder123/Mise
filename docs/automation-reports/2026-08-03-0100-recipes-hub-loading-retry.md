# Recipes hub loading + false-empty polish (2026-08-03)

## Gap
Recipes settings always full-screen loaded on focus and treated load failures as a blank screen with plain error text:
- First-load failures did not expose RetryNotice.
- Soft refresh after save/unlink/add remounted a full loading overlay.
- Mapped-dish empty copy could flash “No recipes mapped yet” when the hub was not ready.

## Change
- Soft-refresh hub load (Inventory/Settings/Insights pattern): full-screen loading only for first paint / restaurant switch.
- `services/presentation/recipesHubPresentation.ts` keeps loading/error copy distinct from true empty/unmapped dishes.
- `RetryNotice` on load failure with `load(true)`.
- i18n: EN / ES / zh-Hans keys for retry/loading/unavailable empty and section action copy.
- Tenant-safety gate updated to require `resolveRecipesHubLoadState` + `hubReady`.

## Verification
- `npm run typecheck`
- `npm test` — 409 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-a9de` (FF from `1159` tip + Insights + Recipes polish)
