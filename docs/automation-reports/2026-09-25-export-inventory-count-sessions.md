# Export inventory count sessions and lines (2026-09-25)

## Summary

Restaurant data export omitted `inventory_count_sessions` and `inventory_count_lines`
even though those tables are the durable count workflow and already allow
authenticated member SELECT. Settings → Export (and demo export) therefore dropped
count history that operators are entitled to take with them.

## Changes

- Edge `export-restaurant-data` catalogs both tables after `inventory_events`, still
  scoped with `.eq("restaurant_id", restaurantId)` on the caller JWT (SELECT is
  already granted to authenticated members; no service-role grant required).
- Client `RESTAURANT_EXPORT_DATASETS` includes the same names so hosted payloads
  normalize without failing closed as incomplete.
- Demo export flattens in-memory count session details into session + line rows
  for the active restaurant.
- Static tests pin edge coverage, client catalog membership, demo fill, and
  edge/client ordering alignment.

## Out of scope

- Service-role routing for `purchase_decision_events` (open #400).
- Backfilling other intentionally empty demo datasets (`purchase_lines`, recipes, …).
- Inventing MOQ / lead time / expiration fields.

## Verification

- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm run design:static`
- focused export tests
- `npm test`
