# History sample days fact (2026-11-06)

PR: https://github.com/RAWCoder123/Mise/pull/1133

## Summary

Inventory detail already buried restaurant demand-memory depth in basis prose
("Based on N recent service days"). Operators scanning the recent-usage fact
grid could not see how many service-day samples backed the recommendation.

This tip adds a deterministic `historySampleDaysFact` on
`InventoryPrediction` and surfaces it on inventory detail in EN / ES /
zh-Hans — only when Mise has `restaurant_history` evidence and the projection
is not contaminated.

## Changes

- `services/domain/historySampleDaysFact.ts` — `computeHistorySampleDaysFact`
- `services/domain/miseDomain.ts` — wire fact beside raw `historySampleDays`
- `types/mise.ts` — `historySampleDaysFact: number | null`
- `app/inventory/[id].tsx` — recent-usage fact + explanation
- `i18n/catalog.ts` — EN / ES / zh-Hans copy
- Focused `tests/historySampleDaysFact.test.ts`
- Fixture updates for prediction object literals

## Ownership

Owns only the scannable history-sample-days fact and its inventory-detail
presentation. Leaves baseline daily usage (#1131), mapped today usage
(#1132), demand intensity (#1130), forecast confidence (#1126), order-by /
stockout / waste / near-term / order-quantity tips (#1123–#1129), Home
`recommendationConfidence` reuse, and purchase authority alone.

## Alone-OK

No migration. Alone-OK on main beside #1100–#1132; ordinary UI conflicts
possible with inventory detail stacks that also extend the recent-usage fact
grid.

## Verification

- Focused `tests/historySampleDaysFact.test.ts`
- `npm run typecheck`
- `npm run security:static` + `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready explainability tip. Not App Store submission-ready.
