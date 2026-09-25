# Demo inventory_events export: projection_applied (2026-09-25)

## Summary

Demo restaurant data export now includes `projection_applied` on every
`inventory_events` row, matching the hosted table column and the domain
fail-closed contract (`absent` / undefined → applied).

## Why

Hosted export returns `inventory_events` via SELECT *, so operators already get
`projection_applied`. Demo `buildDemoRestaurantExport` stripped it, so privacy
exports could not distinguish delayed/unapplied ledger history from applied
movements — the same authority bit stamped on write.

## Changes

- `services/repositories/demoRepository.ts` — add `projection_applied` to the
  inventory_events export mapper (`event.projectionApplied !== false`).
- `tests/restaurantDataExportClient.test.ts` — static pin on the mapper.
- `tests/demoInventoryEventsExport.test.ts` — behavioral proof: count exports
  `true`, delayed receipt before the count exports `false`, every row is boolean.

## Out of scope

- Hosted edge export (already SELECT *).
- `authority_projected_quantity` (demo does not stamp it).
- Open stacks #348–#404 (no duplicate of projection write/bounds parity, PDE
  export, count-session export, purchase_lines export, orphan mutators).

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/demoInventoryEventsExport.test.ts tests/restaurantDataExportClient.test.ts`
- Related export tests + `npm run security:static` / `design:static` as run in tip
