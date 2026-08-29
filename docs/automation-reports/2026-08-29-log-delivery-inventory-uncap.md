# Log Delivery inventory uncapped ranked search (2026-08-29)

## Gap

More → Log Delivery already had text search on the item picker, but results
were hard-capped with `.slice(0, 40)`. Restaurants with more than 40 SKUs could
not browse or find later items when logging a receipt — a false completeness
claim relative to the loaded inventory list.

Open #172 also touches `log-delivery.tsx` for false-empty fail-closed work;
this change intentionally scopes to removing the soft-cap and adding ranked
find + truthful “Showing X of Y” copy. Rebase may be needed when #172 lands.

Open #251 uncapped Scan Item with the same pattern; this tip is the Log
Delivery counterpart and does not share domain modules with that draft.

## Fix

- Domain: `services/domain/logDeliveryInventorySearch.ts` —
  `filterLogDeliveryInventoryBySearch` ranks name / id / category / supplier /
  unit; empty query returns the full uncapped caller list.
- UI: `app/more/log-delivery.tsx` uses the helper; removes the soft-cap; shows
  inventory / matches / “Showing {shown} of {total}” list titles.
- i18n EN / ES / zh-Hans: `logDelivery.search.showing`, `logDelivery.allItems`,
  `logDelivery.results`.
- Tests: `tests/logDeliveryInventorySearch.test.ts` (domain + UI static pin).

## Verification

- `npm run typecheck`
- focused `logDeliveryInventorySearch` + `localization`
- `npm test`
- `npm run design:static`
- `npm run security:static`

## Out of scope

Scan Item soft-cap (#251), Activity feed text find (#239 i18n overlap), Log
Delivery false-empty fail-closed (#172), open stacks #132–#251 + #147.
