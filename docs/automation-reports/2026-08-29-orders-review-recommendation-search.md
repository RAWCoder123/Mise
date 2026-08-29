# Orders review recommendation ranked search (2026-08-29)

## Gap
`/orders` Review listed every pending purchase recommendation without find.
Long multi-supplier queues forced visual scanning. Closed #67 never merged;
#246 covers draft/sent/history order cards only.

## Fix
- Domain: `services/domain/purchaseRecommendationSearch.ts` —
  `filterPurchaseRecommendationsBySearch` +
  `PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD` (5).
- Matches item name, supplier name, reason, or unit; prefers item hits.
- UI: find when pending recommendations ≥5; showing X of Y; empty-match state;
  query resets on restaurant/lane change; quantity drafts preserved for
  filtered-out rows.
- i18n EN/ES/zh-Hans; unit tests (6).

## Proof
- `npm run typecheck`
- focused purchaseRecommendationSearch + localization
- `npm test`
- `npm run design:static`
- `npm run security:static`
