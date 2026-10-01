# Bound inventory ledger quantity scale (2026-09-03)

## Problem

`inventory_events.quantity` had no fractional-scale ceiling. Canonical conversion
paths already round to 6 decimal places, but domain acceptance, demo/outbox
paths, and hosted inserts still allowed dust quantities with more fractional
places. Magnitude bounds (#371) still permit `1.0000001`. Dust rows pollute
append-only history, projections, and idempotency without meaningful stock
movement.

## Fix

- Domain `acceptInventoryEvent` rejects `invalid_quantity_scale` when
  `fractionalScale(quantity) > LEDGER_QUANTITY_MAX_SCALE` (6).
- Transport maps the matching `22023` message ahead of the generic quantity
  matcher so outbox retries settle terminally.
- Additive migration `20260903190000_bound_inventory_event_quantity_scale.sql`
  installs a BEFORE INSERT trigger and a `NOT VALID` CHECK without re-declaring
  `record_inventory_event`.
- Dedicated pgTAP `inventory_event_quantity_scale.test.sql` proves 6-place
  accept and 7-place reject (including signed adjustment).

## Verification

- `npm run typecheck`
- focused: `inventoryLedger`, `inventoryEventTransport`, `inventoryEventQuantityScaleMigration`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` (Docker may be unavailable locally)

## Notes

- Supersedes domain-only #376 by including DB/trigger/pgTAP parity.
- Composes with sibling ledger stacks (#367–#375); does not redeclare the RPC.
- Deploy the additive migration before relying on clear terminal messages hosted.
