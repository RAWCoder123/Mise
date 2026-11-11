# Manual purchase-line entry (2026-11-11)

## Gap
MISE-004C already exposes `ingest_purchase_lines` / demo ingest with manager
authority, durable supplier fail-closed checks, idempotent document positions,
and append-only history. Operators still had no write UI on main, so browse
(#1238) and item-link (#1250) surfaces stay empty in production without a parser
or MISE-006.

## Change
- More → **Record invoice lines** (`app/more/purchase-line-entry.tsx`)
- Presentation builder `services/presentation/purchaseLineEntry.ts`
- EN / ES / zh-Hans copy
- Route/layout smoke registration
- Hub readiness + tenant-safety consumers

No migration. Reuses existing application/repository ingest paths.

## Alone-OK
Does not overlap #1238 (read-only browse), #1250 (links after lines exist),
#397 (schema), #415/#398 (ingest bounds/dates), receive stacks, FEFO, or
ASCII-C padders.

## Verification
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- focused `tests/purchaseLineEntry.test.ts`
- `npm test`
