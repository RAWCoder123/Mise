# Fail closed unsupported inventory receipt sources

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`

## Gap

Managers could call `record_inventory_event` with `event_type = receipt` and an
arbitrary `source` (for example `receiving`, `manual`, or a case-variant label).
Production receipts only stamp `operator_receipt` (ad-hoc Log Delivery) or
`supplier_delivery` (Mark received). Arbitrary labels still moved on-hand while
dodging double-count guards that key on exact `operator_receipt` and forging or
blanking delivery-history write-path badges.

## Change

- Domain rejects receipt sources outside `{operator_receipt, supplier_delivery}`
  (`unsupported_receipt_source`); exact trim match so case variants cannot
  bypass the separate supplier_delivery provenance guard
- Additive BEFORE INSERT trigger enforces the same allowlist on every write path
- Transport maps the hosted `22023` message ahead of generic matchers
- pgTAP covers forged/case-variant rejects, operator accept, non-receipt
  unconstrained, supplier_delivery fixture allow, and direct-insert reject

## Out of scope

- Supplier delivery receipt provenance requiring a same-tenant delivery row (#1259)
- Forged Mise-attributed sources (#1260)
- Evidence field bounds (#1261)
- Forged approve_count_session sources (#1262)
- Delivery history labeling (#1244) and double-count UX (#267)
- Purchase-line invents (#1238/#1250–#1258)

## Verification

- `npm run typecheck`
- Focused allowlist + ledger + transport + outbox tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
