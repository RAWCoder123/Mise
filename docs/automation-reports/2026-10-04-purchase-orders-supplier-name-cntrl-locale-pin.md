# MISE-005GU: purchase_orders.supplier_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`purchase_orders_supplier_name_check` as
`length(trim(supplier_name)) between 1 and 160` plus
`supplier_name collate "C" !~ '[[:cntrl:]]'`.

The backbone column is NOT NULL text with no dedicated length or cntrl gate.
`purchase_orders_operational_values_check` only requires non-empty
supplier_name and non-negative subtotal_estimate. `inventory_items.supplier_name`
on main already gates length(trim) 1..160. This tip locks that length bound
under COLLATE "C" so dump/restore cannot accept purchase-order supplier-name
bytes a restored C-locale path would refuse. The shared operational_values_check
is left intact.

`supplier_name` is classified as a single-line purchase-order supplier display
snapshot (historical readability after MISE-003C durable `supplier_id`
authority), not free-form multiline prose.

## Scope

- CHECK-only; does not rewrite purchase-order writers or durable supplier_id
  authority
- Leaves operational_values_check, supplier_id_required_check, status, and
  subtotal_estimate untouched
- Alone-OK versus open #610 / #609 / #608 / #603 / #605 (different tables or
  columns)

## Verification

- `npm run typecheck` passed
- focused `purchaseOrdersSupplierNameCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 13 from 13 assertion call sites (Docker/pgTAP unavailable in this environment)
