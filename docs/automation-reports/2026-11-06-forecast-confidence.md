# Forecast confidence on inventory predictions

Date: 2026-11-06  
Branch: `cursor/mise-forecast-confidence-main`  
PR: https://github.com/RAWCoder123/Mise/pull/1126

## Summary

Inventory predictions already carried prose confidence copy. Operators still
could not see a structured confidence level beside coverage. This tip adds a
deterministic 0–1 `forecastConfidence` derived from demand-history evidence and
verified-count freshness, surfaces it on Inventory detail in EN / ES / zh-Hans,
and keeps contaminated projections null rather than inventing a score.

## Behavior

- `computeForecastConfidence` mixes history source / sample days, count age, and
  temporal authority into a capped score (ceiling 0.92).
- Urgency (Critical/Low) does not inflate confidence — confidence stays distinct
  from "act soon."
- Contaminated projections return `null`.
- Inventory detail shows a percent fact and a localized explanation when the
  score is present.

## Non-goals

- No migration.
- Does not change purchase authority, supplier send, or Home approval confidence.
- Does not invent lead time, MOQ, shelf life, order-by date, stockout date, or
  stockout probability (those remain in open tips #1116–#1125).

## Verification

- `npm run typecheck`
- Focused `tests/forecastConfidence.test.ts`
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
