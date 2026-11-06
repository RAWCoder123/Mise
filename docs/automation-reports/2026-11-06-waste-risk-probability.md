# Waste risk probability on inventory predictions

Date: 2026-11-06
Branch: `cursor/mise-waste-risk-probability-main`

## Summary

Surface a deterministic `wasteRiskProbability` on `InventoryPrediction` so
operators can see overstock / spoil pressure beside days of coverage. The score
reuses the existing eight-day “unusually high stock” holding window already used
in coverage copy — it does not invent shelf-life metadata or fitted models.

## Behavior

- `computeWasteRiskProbability` returns a 0–1 score from projected coverage
  versus an eight-day holding horizon (`max(0, min(1, daysCoverage/8 - 1))`).
- Null when the projection is contaminated or Mise has no demand rate.
- Inventory detail shows a percent fact plus localized EN / ES / zh-Hans
  explanation copy.
- No migration. Alone-OK on `main` beside open inventory tip stacks.

## Verification

- `npm run typecheck`
- Focused `wasteRiskProbability` tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
