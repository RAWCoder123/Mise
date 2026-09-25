# Demo restaurant_operational_controls export parity

Date: 2026-09-25  
Base: `origin/main` @ `78da737`

## Problem

Hosted restaurants always receive one `public.restaurant_operational_controls`
row (migration seed + `ensure_restaurant_operational_controls` AFTER INSERT
trigger) with every provider kill switch off and `ordering_policy = 'off'`.
Demo privacy export left `restaurant_operational_controls: []`, so Settings →
Export falsely claimed controls were absent while hosted always ships the
fail-closed row.

## Change

- `buildDemoRestaurantExport` now emits exactly one snake_case controls row via
  `demoRestaurantOperationalControlsExportRow`, matching hosted defaults
  (`square_sync_enabled`, `square_webhooks_enabled`, `gmail_delivery_enabled`,
  `insight_generation_enabled`, `order_drafting_enabled`,
  `stripe_invoicing_enabled` all `false`; `ordering_policy = 'off'`;
  `updated_by = null`).
- Demo does not invent live provider enablement; the row remains default-off,
  which is truthful for local demo (no live Square/Gmail/drafting).

## Out of scope

- Persisting mutable demo kill-switch state / pilot control RPCs
- Open stacks #348–#406 (ledger gates, export snake_case, projection parity)
- Inventing MOQ / lead_time / expiration

## Verification

- `npm run typecheck`
- focused: `tests/demoRestaurantOperationalControlsExport.test.ts`,
  `tests/restaurantDataExportClient.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend` (when available)
- `npm run design:static`
