# Inventory correction requires supersede (2026-09-04)

## Completed

- Domain `acceptInventoryEvent` rejects orphan `correction` rows
  (`correction_requires_supersede`) so demo/domain parity matches hosted.
- Additive migration `20260904120000_inventory_correction_requires_supersede.sql`:
  - BEFORE INSERT trigger `inventory_events_correction_requires_supersede`
  - Tightened CHECK `(event_type = 'correction') = (supersedes_event_id is not null)`
    as `NOT VALID` so legacy orphans are never rewritten while new inserts fail closed
- pgTAP: orphan correction rejected; linked correction accepted; second supersede denied
- Pin test `tests/inventoryCorrectionSupersedeAuthority.test.ts`

## Why

Corrections are audited repairs of a specific prior ledger row. Orphan corrections
projected as arbitrary signed deltas under false correction semantics without an
auditable supersede target. Product writers (#345/#350) already stamp supersedes;
this closes the DB/domain gap.

## Verification

- `npm run typecheck`
- focused unit/pin tests + `npm test`
- `npm run security:static` / `npm run security:backend` when available
- `npm run supabase:test` blocked without Docker in this environment

## Classification impact

Controlled pilot integrity hardening. Does not change App Store / founder blockers.
