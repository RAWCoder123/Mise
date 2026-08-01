# Setup inventory ledger movements (2026-08-01)

## Problem

`save_restaurant_setup` upserted `inventory_items.current_quantity` without appending `inventory_movements`. Opening stock and later setup quantity edits silently replaced on-hand values, unlike `create_inventory_item` and count/update workflows.

## Change

- Migration `20260801030000_setup_inventory_ledger_movements.sql` replaces `save_restaurant_setup` so that:
  - new inventory rows write an opening `manual_count` movement (`0 → quantity`, `source_workflow = save_restaurant_setup`);
  - quantity deltas on existing rows append another `manual_count` movement;
  - identical-quantity replays remain idempotent (no duplicate ledger rows).
- Local demo `saveRestaurantSetupSnapshot` mirrors the same ledger behavior.
- pgTAP asserts opening, replay uniqueness, and quantity-change appends.
- Static security contract covers migration + demo repository wiring.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run design:static`, `npm run qa:routes` in this cycle when the environment allows.
- Docker/hosted `verify:private-beta-security` remains blocked here without Docker/staging credentials.
- Full `supabase/schema.sql` dump refresh still needs Docker.
