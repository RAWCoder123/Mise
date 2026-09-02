# Square POS returns (2026-09-02)

## Gap
Square order sync ignored `returns[].return_line_items`, and `pos_sales.quantity_sold`
must stay `> 0`, so refunds never reversed inventory depletion or planning demand.

## Slice
- Additive `pos_sales.record_kind` (`sale` | `return`); quantity stays positive
- `normalizeOrderSales` emits return rows with `square_{order}_return_{uid}` ids
- Sync base apply persists `record_kind`
- `fetch_planning_sales` keeps returns as distinct rows (sale aggregates exclude them)
- Domain/signals use `posSaleQuantityDelta` for signed depletion and demand

## Non-goals
- Cash-only refunds without itemized return lines
- Modifier return deltas
- MOQ / lead_time / expiration invention
- UI for browsing returns

## Proof
- Focused `tests/posSaleReturns.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static` / `design:static` as applicable
