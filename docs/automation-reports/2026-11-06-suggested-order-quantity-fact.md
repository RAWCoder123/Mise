# Suggested order quantity fact on inventory predictions

Date: 2026-11-06  
Branch: `cursor/mise-suggested-order-quantity-fact-main`  
PR: (filled after open)

## Summary

Inventory predictions already computed `suggestedOrderQuantity` for recommendation
prose and purchase inserts. Operators still could not scan a structured order size
beside coverage. This tip adds `suggestedOrderQuantityFact` that surfaces the same
quantity only when Mise is recommending a buy (Critical/Low) and the projection is
not contaminated, with localized EN / ES / zh-Hans copy on Inventory detail.

## Behavior

- `computeSuggestedOrderQuantityFact` returns the planning quantity for Critical/Low
  with a positive `suggestedOrderQuantity`.
- Contaminated projections, Watch/Good coverage, and non-positive quantities stay
  `null` rather than inventing a buy size.
- The fact matches `suggestedOrderQuantity` so later pack-rounding or learned-quantity
  tips that refine that field stay coherent with the detail surface.

## Non-goals

- No migration.
- Does not change purchase authority, supplier send, or Home approval confidence.
- Does not invent lead time, MOQ, shelf life, order-by date, stockout, waste risk,
  forecast confidence, or expected near-term usage (those remain in open tips
  #1116–#1128).

## Verification

- `npm run typecheck`
- Focused `tests/suggestedOrderQuantityFact.test.ts`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
