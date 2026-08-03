# Insights hub loading + false-empty polish (2026-08-03)

## Gap
Insights hub treated unloaded/failed summary, sales trend, and manager brief as true empty learning states:
- First-load failures claimed “waiting for signals” / “still learning” / “no recorded sales” beside RetryNotice.
- Soft refresh on focus always used a weaker `hasLoaded` flag instead of the Inventory/Settings restaurant-ref pattern.

## Change
- Soft-refresh hub load (Inventory/Settings/Orders pattern): full-screen loading only for first paint / restaurant switch.
- `services/presentation/insightsHubPresentation.ts` keeps loading/error copy distinct from true empty learning.
- Summary, trend empty state, brief empty state, and brief action labels stay distinct while loading or failed.
- i18n: EN / ES / zh-Hans keys for loading/unavailable summary, brief, and trend copy.
- Tenant-safety gate updated to require `resolveInsightsHubLoadState` + `hubReady`.

## Verification
- `npm run typecheck`
- `npm test` — 406 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-a9de` (FF from `1159` tip + this work)
