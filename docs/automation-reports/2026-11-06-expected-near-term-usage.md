# Expected near-term ingredient usage on inventory predictions

Date: 2026-11-06  
Branch: `cursor/mise-expected-near-term-usage-main`  
PR: (pending)

## Summary

Inventory predictions already exposed average daily usage and days of coverage.
Operators still could not see a structured expected-usage quantity for the next
planning week. This tip adds deterministic `expectedNearTermUsage` (seven
service days at the current demand rate), surfaces it on Inventory detail in
EN / ES / zh-Hans, and keeps contaminated or no-demand cases null rather than
inventing a quantity.

## Behavior

- `computeExpectedNearTermUsage` multiplies a positive daily usage rate by seven
  service days and rounds to hundredths.
- Contaminated projections and missing demand return `null`.
- Inventory detail shows the quantity+unit fact and a localized explanation when
  the value is present.

## Non-goals

- No migration.
- Does not change purchase authority, supplier send, Home approval confidence,
  stockout/waste/forecast fields in open tips #1116–#1127, expiration-on-receive,
  or fitted statistical models.

## Verification

- `npm run typecheck`
- Focused `tests/expectedNearTermUsage.test.ts`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
