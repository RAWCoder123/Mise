# Inventory station health fail-closed (2026-08-04)

## Gap
`/inventory` converted `fetchInventoryLocationHealthBreakdown` failures into `null`, which hid the station block and made multi-station filters look absent instead of failed.

## Change
- Presentation helpers distinguish station-health load `ready` / `empty` / `unavailable`.
- Inventory hub captures `load_station_health` failures, keeps item outlooks available, and shows a localized RetryNotice when station health cannot load.
- EN / ES / zh-Hans copy for unavailable station health.
- Tests cover helpers, catalog coverage, and removal of the silent `.catch(() => null)` fallback.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
