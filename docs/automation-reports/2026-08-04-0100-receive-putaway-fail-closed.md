# Receive put-away fail-closed (2026-08-04)

## Gap
`/orders/[id]` converted `fetchStorageLocations` failures into an empty list, treated empty stations as location-ready, and allowed Receive to continue. The service RPC then defaulted null put-away lines to Main, silently mis-attributing station balances.

## Change
- Presentation helpers distinguish put-away load `ready` / `empty` / `unavailable`.
- Order detail captures `load_storage_locations` failures, keeps order load soft-available, blocks Receive when stations are unavailable, and shows a localized RetryNotice.
- EN / ES / zh-Hans copy for unavailable put-away stations.
- Tests cover readiness helpers, catalog coverage, and removal of the silent `.catch(() => [])` fallback.

## Verification (passed on 37a2)
- `npm run typecheck`
- `npm test` — 518 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
