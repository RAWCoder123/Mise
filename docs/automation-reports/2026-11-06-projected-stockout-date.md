# Projected inventory stockout date (2026-11-06)

## Summary

Inventory predictions already estimated `daysCoverage`, but operators still had
to invent the calendar day stock would hit zero. This tip computes a
deterministic `projectedStockoutDate` — the operating day projected on-hand
would reach zero at the current demand rate — and surfaces it on inventory
detail with EN/ES/zh-Hans copy.

## Changes

- Pure `computeProjectedStockoutDate` helper (null when contaminated or no demand rate)
- `InventoryPrediction.projectedStockoutDate` + `daysUntilStockout`
- Inventory detail fact + localized explanation
- Focused domain + prediction wiring tests

## Why

Closes the operator gap between “about N days of coverage” and “stockout by
this date” without inventing dates when evidence is missing. Distinct from the
suggested order-by date (#1123), which answers when to reorder relative to the
threshold rather than when on-hand reaches zero.

## Out of scope

Lead time / MOQ / safety stock / shelf life / delivery schedule / order-by date
(#1116–#1123), expiration-on-receive, purchase authority, migrations.

## Verification

- `npm run typecheck` pass
- Focused `tests/projectedStockoutDate.test.ts` 5/5
- `npm test` 688 pass / 0 fail / 0 cancelled
- `npm run security:static` / `security:backend` / `design:static` pass

## Notes

- Alone-OK on current `origin/main` (`78da7376`)
- Ordinary UI conflicts possible with #1116–#1123 inventory detail stacks
- PR: https://github.com/RAWCoder123/Mise/pull/1124 @ `9347af47`
