# Near-term inventory stockout probability (2026-11-06)

## Summary

Inventory predictions already estimated `daysCoverage`, and open tips surface
calendar stockout / order-by dates. Operators still lacked an explicit
near-term stockout probability grounded in that same demand rate. This tip
computes a deterministic `stockoutProbability` — the chance projected on-hand
reaches zero within the next two service days at the current demand rate —
and surfaces it on inventory detail with EN/ES/zh-Hans copy.

## Changes

- Pure `computeStockoutProbability` helper (null when contaminated or no demand rate)
- `InventoryPrediction.stockoutProbability`
- Inventory detail fact + localized explanation
- Focused domain + prediction wiring tests

## Why

Closes the operator gap between “about N days of coverage” and “how likely is
a near-term stockout?” without inventing a percentage when evidence is missing.
Distinct from projected stockout date (#1124), which answers which calendar day
on-hand reaches zero rather than the two-day risk mass.

## Out of scope

Lead time / MOQ / safety stock / shelf life / delivery schedule / order-by /
stockout date (#1116–#1124), expiration-on-receive, purchase authority,
migrations, fitted statistical models.

## Verification

- `npm run typecheck` pass
- Focused `tests/stockoutProbability.test.ts` 5/5
- `npm test` 688 pass / 0 fail / 7 cancelled
- `npm run security:static` / `security:backend` / `design:static` pass

## Notes

- Alone-OK on current `origin/main` (`78da7376`)
- Ordinary UI conflicts possible with #1116–#1124 inventory detail stacks
- PR: https://github.com/RAWCoder123/Mise/pull/1125 @ `29ebcfd1`
