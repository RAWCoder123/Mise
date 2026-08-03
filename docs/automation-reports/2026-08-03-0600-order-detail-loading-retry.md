# Order detail soft-refresh polish (2026-08-03)

## Gap
- `/orders/[id]` always hard-loaded, cleared the prior draft/order on soft-refresh failure, and treated load failures as a not-found empty state without RetryNotice.

## Change
- Soft-refresh order detail load (inventory-detail pattern): Screen loading only for first paint / restaurant or order switch; action retries use `load(false)`.
- Soft-refresh failures keep prior order, recommendations, receive summary, and storage locations for the same restaurant + order (`keepPrior`).
- `services/presentation/orderDetailPresentation.ts` keeps loading/error copy distinct from true not-found.
- EN / ES / zh-Hans catalog keys for order detail loading, unavailable, and retry accessibility.
- Tenant-safety gates require `hubReady` + presentation helpers on the order detail screen.

## Verification
- `npm run typecheck`
- `npm test` — 428 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-b3cf` (FF from `672b` tip + this work)
