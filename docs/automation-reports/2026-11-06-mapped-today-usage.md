# Mapped today usage (2026-11-06)

## Summary

Inventory predictions now expose `mappedTodayUsage` as a structured fact: the
total recipe-mapped POS demand for the operating day, before the count-window
split that zeros `todayDepletion` when a same-day verified count already
absorbed that demand.

## Why

After a midday count, `todayDepletion` correctly stays `0` so Mise does not
double-subtract sales already inside the counted baseline. Without a separate
mapped-today fact, Inventory detail looked like there was no POS use even when
sales had already happened.

Distinct from presentation-only absorbed-POS copy (#318): this tip adds a
domain-level structured quantity operators can read beside coverage and the
blended per-day rate.

## Changes

- `services/domain/mappedTodayUsage.ts` — deterministic hundredths rounding
- `InventoryPrediction.mappedTodayUsage` wired through `buildInventoryPrediction`
- Inventory detail EN / ES / zh-Hans fact + absorbed-demand explanation
- Focused domain tests for rounding, midday absorb, prior-day count, and learning

## Out of scope

- Demand intensity / baseline / order-by / stockout / waste / forecast facts
  (#1123–#1131)
- Depletion rail / hero POS labels owned by #318
- Purchase authority, migrations, Home recommendationConfidence reuse

## Verification

- `npm run typecheck`
- Focused `tests/mappedTodayUsage.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` / `npm run design:static`
