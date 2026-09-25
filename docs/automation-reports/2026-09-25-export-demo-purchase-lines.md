# Demo export purchase lines (2026-09-25)

## Problem

Restaurant data export catalogs `purchase_lines`, and demo ingest writes
committed rows into `state.purchaseLines`, but `buildDemoRestaurantExport`
always left `purchase_lines: []`. Privacy exports silently dropped purchase
ledger evidence in demo mode.

## Change

- Flatten `state.purchaseLines` into snake_case export rows scoped by
  `restaurant_id`, mirroring purchase decision and inventory event export.
- Behavioral demo test: ingest → export → assert counts, tenant scope, and
  field fidelity (including `could_not_verify` / null prices).
- Static pin so the false-empty assignment cannot regress quietly.

## Out of scope

- Hosted edge catalog (already exports `purchase_lines` via authenticated SELECT).
- Filling recipes / POS mapping demo stores that do not exist in demo state.
- Open stacks #348–#401 (ledger gates, date bounds, PDE service-read, count
  session export, security inventory, MISE-006).
