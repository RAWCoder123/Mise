# Square sale_date restaurant timezone attribution

Date: 2026-09-03  
Branch: `cursor/mise-square-sale-date-timezone`  
Base: `origin/main` @ `20b28e5`

## Problem

Client POS sync already sends restaurant-local date keys via `toDateKeyInTimeZone`, but Edge Square sync treated those keys as UTC day bounds (`T00:00Z`–`T23:59Z`) and stamped `sale_date` from `closed_at.slice(0, 10)` (UTC calendar day). US evening service could land on the wrong operating day for depletion, recommendations, and insights.

## Change

- Attribute `sale_date` with restaurant IANA timezone (same semantics as client `toDateKeyInTimeZone`).
- Convert local `from`/`to` date keys into timezone-correct inclusive Square `closed_at` search bounds.
- Load `restaurants.timezone` in `sync-pos-sales` and `square-webhooks`; invalid/missing zones fail closed to UTC.
- Keep `#360` `sold_at` complementary (instant count boundary ≠ day key); no inventory mutation changes.

## Verification

- Focused `tests/squareBackend.test.ts` timezone + pagination coverage
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend` (when available)

## Explicit non-goals

- Inventing MOQ / lead_time / expiration
- Contested Home `operatingBrief` stacks
- Auto inventory mutation for refunds
- Hosted migration (no schema change)
