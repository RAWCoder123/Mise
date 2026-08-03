# POS hub loading + false-empty polish (2026-08-03)

## Gap
POS connection status could flash another restaurant’s provider (or “Not connected”) while status settled after a restaurant switch. The dedicated POS settings screen had no soft-refresh / RetryNotice path, and the Settings hub POS row ignored load/readiness state unlike Gmail/suppliers/recipes.

## Change
- Session POS status is now keyed by `posStatusRestaurantId` / `posStatusError`, and clears before the next restaurant’s status settles.
- `services/presentation/posHubPresentation.ts` keeps loading/error copy distinct from true disconnected/CSV-ready states.
- POS settings screen soft-refreshes on focus, full-screen loads only for first paint / restaurant switch, and exposes `RetryNotice` with `load(true)`.
- Settings hub POS row uses `presentSettingsHubPosCopy` gated on hub + POS readiness.
- EN / ES / zh-Hans catalog keys for POS loading, unavailable, retry, and section actions.
- Tenant-safety gate updated for POS hub readiness.

## Verification
- `npm run typecheck`
- `npm test` — 413 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-1dc2` (FF from `a9de` tip + POS hub polish)
