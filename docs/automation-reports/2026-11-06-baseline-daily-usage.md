# Baseline daily usage on inventory predictions

Date: 2026-11-06  
Branch: `cursor/mise-baseline-daily-usage-main`  
PR: (opened by automation)

## Summary

Inventory predictions already blend today's mapped POS demand with historical
baseline into `averageDailyUsage`, and open tip #1130 surfaces demand intensity
as today ÷ baseline. Operators still could not scan the usual baseline rate
itself beside the blended per-day figure. This tip adds `baselineDailyUsage`
as a structured fact on Inventory detail with localized EN / ES / zh-Hans copy.

## Behavior

- `computeBaselineDailyUsage` returns the positive historical (or labeled demo)
  mapped daily rate, rounded to two decimals.
- Contaminated projections and missing positive baselines stay `null` rather
  than inventing a usual rate from a single day alone.
- When today is hotter than history, blended `averageDailyUsage` rises while
  `baselineDailyUsage` stays at the historical rate so intensity and coverage
  remain explainable.

## Non-goals

- No migration.
- Does not change purchase authority, supplier send, or Home approval confidence.
- Does not invent demand intensity, order quantity, order-by date, stockout,
  waste risk, forecast confidence, or expected near-term usage (those remain in
  open tips #1123–#1130).

## Verification

- `npm run typecheck`
- Focused `tests/baselineDailyUsage.test.ts`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
