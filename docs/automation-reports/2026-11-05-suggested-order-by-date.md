# Suggested inventory order-by date (2026-11-05)

## Summary

Inventory predictions now expose a deterministic `suggestedOrderByDate` — the
operating calendar day when projected on-hand would hit the reorder threshold at
the current demand rate. Inventory detail surfaces the date beside coverage so
operators see when to order, not only how much.

## Changes

- Domain helper `computeSuggestedOrderByDate` (pure; null when contaminated, no
  demand rate, or no positive order quantity)
- `InventoryPrediction.suggestedOrderByDate` + `daysUntilSuggestedOrder`
- Inventory detail fact + localized explanation (EN / ES / zh-Hans)
- Focused unit + prediction wiring tests

## Why

Mise already estimated coverage days and suggested order quantity. Operators
still had to mentally convert coverage into a calendar order date. This closes
that gap with explainable arithmetic and without inventing dates when evidence
is missing.

## Out of scope

Lead time / MOQ / safety stock / delivery-schedule policy fields (#1116–#1120),
expiration-on-receive, purchase authority changes, migrations.

## Verification

- `npm run typecheck`
- Focused `tests/suggestedOrderByDate.test.ts`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
