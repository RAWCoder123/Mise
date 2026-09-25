# Demo restaurant export persisted shape parity

Date: 2026-09-25  
Base: `origin/main` @ `78da737`  
Branch: `cursor/bc-df4f27e5-3900-4e99-9346-8e0299207ac1-e066`

## Problem

Demo `buildDemoRestaurantExport` already flattened ledger datasets
(`inventory_events`, `purchase_decision_events`) to hosted snake_case columns,
but operational-backend datasets only spread domain objects and tacked on
`restaurant_id`. Hosted export is `SELECT *` from Postgres, so demo privacy
exports could ship camelCase (`activityType`, `occurredAt`, `serviceWindow`)
while still counting rows as present.

## Change

- Add `*ToPersisted*` mappers beside existing `*FromPersisted*` helpers for:
  - `mise_actions` / `action_outcomes`
  - `restaurant_memories`
  - `restaurant_autonomy_rules`
  - `restaurant_tasks`
  - `recalculation_runs`
- Reuse existing `activityEventToPersistedInsert`
- Wire `buildDemoRestaurantExport` through those mappers

## Verification

- `npm run typecheck` — pass
- `npm test` — 679 pass / 0 fail / 7 cancelled
- `npm run security:static` — pass
- Focused: `tests/demoRestaurantExportPersistedShape.test.ts`,
  `tests/restaurantDataExportClient.test.ts`

## Not in this tip

- Open stacks #348–#405 (inventory gates, other export gaps, orphan mutators)
- Demo `restaurant_operational_controls` still empty (hosted kill-switch row)
- Inventing MOQ / lead_time / expiration / recipe-POS demo stores
