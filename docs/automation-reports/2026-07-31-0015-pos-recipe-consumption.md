# POS recipe consumption ledger

Date: 2026-07-31

## Problem

Manual CSV POS ingest stored sales and refreshed recommendations, but never deducted mapped ingredients from `current_quantity`. Projections already estimated recipe usage virtually, so on-hand stayed at the last manual count while Today/Orders treated sales as if they had already depleted stock.

## Change

- Added pure `buildRecipeConsumptionPlan` / applied-consumption helpers in `services/domain/posConsumption.ts`.
- Demo CSV ingest now writes idempotent `recipe_consumption` movements and updates on-hand.
- Hosted path: migration `20260731001500_apply_pos_recipe_consumption.sql` applies the same ledger writes inside `service_ingest_manual_pos_sales`, with unique `(restaurant_id, inventory_item_id, source_record_id)` protection.
- Predictions and operational signals subtract only **unapplied** today’s usage so applied ledger rows are not double-counted.
- Planning snapshot now exposes `appliedTodayConsumptionByItemId`.
- Inventory detail history labels all movement reasons (EN/ES/zh-Hans).

## Verification

- `tests/posConsumption.test.ts` covers plan math, projection adjustment, demo deduct-once behavior.
- Security static assertions cover the new service-only apply function and grants.
