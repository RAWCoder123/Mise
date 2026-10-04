# MISE-005GV: supplier_orders.supplier_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`supplier_orders_supplier_name_check` as
`length(trim(supplier_name)) between 1 and 160` plus
`supplier_name collate "C" !~ '[[:cntrl:]]'`.

The backbone column is NOT NULL text with no dedicated length or cntrl gate.
`supplier_orders_operational_values_check` only requires non-empty
supplier_name and non-empty order_message. `inventory_items.supplier_name`
on main already gates length(trim) 1..160. This tip locks that length bound
under COLLATE "C" so dump/restore cannot accept supplier-order supplier-name
bytes a restored C-locale path would refuse. The shared operational_values_check
is left intact (drop protection uses `not ilike '%order_message%'`).

`supplier_name` is classified as a single-line supplier-order supplier display
snapshot (historical readability after MISE-003C durable `supplier_id`
authority), not free-form multiline prose.

## Scope

- CHECK-only; does not rewrite supplier-order writers or durable supplier_id
  authority
- Leaves operational_values_check, status, operator_note, email delivery,
  message size, purchase authority, and send-content revision untouched
- Alone-OK versus open #611 / #610 / #609 / #608 / #603 / #605 (different
  tables)

## Verification

- `npm run typecheck` passed
- focused `supplierOrdersSupplierNameCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 13 from 13 assertion call sites (Docker/pgTAP unavailable in this environment)
