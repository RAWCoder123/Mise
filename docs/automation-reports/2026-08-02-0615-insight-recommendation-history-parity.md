# Insight recommendationHistory parity (2026-08-02)

Branch: `cursor/mise-product-inspection-9e8d`

## Problem

`operationalSignals.buildInsightsFromData` hard-coded `recommendationHistory: []`, so local/client regenerations after inventory, recipe, waste, count, receive, and demo POS refresh omitted acceptance-edit and dismissal chronic insights even when recommendation history was already fetched for order inserts.

## Implemented

1. `buildInsightsFromData` accepts `recommendationHistory` and forwards it to `calculateOperationalSignals`.
2. Application callers pass the already-fetched history:
   - `services/application/recalculations.ts`
   - `services/application/inventory.ts`
   - `services/application/orders.ts`
3. Unit coverage asserts empty history hides chronic dismissal insights and supplied history emits them.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
