# Orders lane ranked search (2026-08-29)

## Gap
`/orders` drafts, sent, and history listed every supplier order without find.
Long queues forced visual scanning. Closed PR #69 never merged onto current main.

## Implementation
- `services/domain/supplierOrderLaneSearch.ts`: `filterSupplierOrdersBySearch` +
  `SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD` (5). Matches supplier name, order message,
  or operator note. Empty query preserves caller order.
- `app/(tabs)/orders.tsx`: find UI when the active lane has ≥5 orders; showing
  X of Y; empty-match copy; query resets on restaurant or lane change.
- `i18n/catalog.ts`: EN / ES / zh-Hans `orders.lane.search.*`.
- `tests/supplierOrderLaneSearch.test.ts`: 5 unit cases.

## Verification
- `npm run typecheck`
- focused `supplierOrderLaneSearch` + `localization` tests
- `npm test`
- `npm run design:static` / `npm run security:static` when available

## Out of scope
Recommendation review search, POS mapping search, create-task dependency picker,
landing/rebasing open stacks #132–#245.
