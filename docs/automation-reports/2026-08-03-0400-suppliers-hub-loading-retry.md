# Suppliers hub loading + false-empty polish (2026-08-03)

Branch: `cursor/mise-product-inspection-bd08` (FF from `c21c` + this change)

## Gap

`/settings/suppliers` treated load failures and restaurant switches as an empty directory (“No suppliers yet”), and every focus/reload used a hard loading path. Soft-refresh failures also lacked `RetryNotice` parity used by Team/Gmail/POS.

## Fix

- Soft-refresh Supplier load (Team/Gmail pattern): Screen loading only for first paint / restaurant switch.
- `RetryNotice` with `load(true)` on failure; prior directory remains after soft-refresh failure.
- `services/presentation/suppliersHubPresentation.ts` keeps loading/error copy distinct from true empty directory.
- EN/ES/zh-Hans empty/configured-count loading and unavailable copy.
- Tenant-safety + supplier recipient route tests gate suppliers via `hubReady` + `resolveSuppliersHubLoadState`.

## Proof

- `npm run typecheck` passed
- `npm test` — 422 passed / 0 failed
- `npm run security:static` passed
- `npm run security:backend` passed
- `npm run design:static` passed
- `npm run qa:routes` passed (includes `/settings/suppliers`)
- Docker `supabase:test` still unavailable in this environment
