# Scan Item inventory uncapped ranked search (2026-08-29)

## Gap

More → Scan Item already had text search, but results were hard-capped with
`.slice(0, 40)`. The section title used the full `visibleItems.length` when the
query was empty, so restaurants with more than 40 SKUs saw a complete count
while only the first 40 rows rendered — a false completeness claim.

Open #172 touches `log-delivery.tsx` (same soft-cap pattern) for false-empty
fail-closed work; this change intentionally scopes to Scan Item only.

## Fix

- Domain: `services/domain/scanItemInventorySearch.ts` —
  `filterScanItemInventoryBySearch` ranks name / id / category / supplier /
  unit; empty query returns the full uncapped caller list.
- UI: `app/more/scan-item.tsx` uses the helper; removes the soft-cap and local
  `matchesQuery`; shows “Showing {shown} of {total}” when a query narrows the
  list.
- i18n EN / ES / zh-Hans: `scanItem.search.showing`.
- Tests: `tests/scanItemInventorySearch.test.ts` (domain + UI static pin).

## Verification

- `npm run typecheck`
- focused `scanItemInventorySearch` + `localization`
- `npm test`
- `npm run design:static`
- `npm run security:static`

## Out of scope

Log Delivery soft-cap (open #172), Activity feed text find, barcode match
limit (separate from browse list), open stacks #132–#250 + #147.
