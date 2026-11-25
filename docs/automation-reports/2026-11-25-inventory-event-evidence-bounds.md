# Bound inventory event evidence fields (2026-11-25)

## Gap

`inventory_events` capped `source`, `client_event_id`, and `idempotency_key`, but left
`metadata`, `source_reference`, and `reason_code` unbounded. An authenticated
owner/admin/manager could call `record_inventory_event` with megabyte-scale JSON or
free-text and permanently enlarge the append-only ledger—including
`supplier_delivery` receipts that skip Activity emission.

## Change

- Domain `acceptInventoryEvent` rejects oversized metadata / source_reference /
  reason_code so offline outbox paths settle without retry loops.
- Additive BEFORE INSERT trigger
  `private.reject_oversized_inventory_event_evidence` raises the same failures as
  `22023` for every insert path.
- Table CHECK constraints mirror the 8 KiB / 200 / 80 bounds as defense in depth.
- Transport maps the hosted messages to terminal outbox reasons ahead of the
  generic `evidence` matcher.

## Alone-OK

Does not overlap forged Mise attribution (#1260), supplier_delivery provenance
(#1259), count-session authority (#388/#393), correction supersede (#394/#395),
usage/adjustment evidence (#396), or the purchase-line invent stack.

## Verification

- `npm run typecheck`
- focused evidence-bounds / ledger / transport tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
