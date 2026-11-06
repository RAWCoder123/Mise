# Demand intensity ratio on inventory predictions

Date: 2026-11-06  
Branch: `cursor/mise-demand-intensity-ratio-main`

## Summary

Inventory predictions already classify demand as rising, falling, normal, or
learning. Operators still could not scan how hot today's mapped POS demand is
relative to the usual baseline. This tip adds `demandIntensityRatio` that
surfaces today's mapped usage ÷ baseline as a structured fact beside coverage,
with localized EN / ES / zh-Hans copy on Inventory detail.

## Behavior

- `computeDemandIntensityRatio` returns today's mapped usage divided by baseline,
  rounded to two decimals.
- Contaminated projections and missing positive baselines stay `null` rather
  than inventing intensity from a single day alone.
- A cold day with zero mapped sales against a positive baseline is a real `0`.
- Threshold constants stay aligned with existing `demandTrend` cutoffs
  (rising above 1.15, falling below 0.8).

## Non-goals

- No migration.
- Does not change purchase authority, supplier send, or Home approval confidence.
- Does not invent order quantity, order-by date, stockout, waste risk, forecast
  confidence, or expected near-term usage (those remain in open tips #1123–#1129).

## Verification

- `npm run typecheck`
- Focused `tests/demandIntensityRatio.test.ts`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
