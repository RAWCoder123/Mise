# MISE-005FU: inventory_items.item_name cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `inventory_items.item_name` labels:

- Reattach `inventory_items_operational_values_check` preserving exact length and numeric bounds.
- Add `item_name collate "C" !~ '[[:cntrl:]]'`.
- Classified as single-line inventory product labels (not free-form multiline prose).
- Does not pin `unit` or `supplier_name` cntrl in this tip.

## Verification

- `npm run typecheck`
- focused `inventoryItemsItemNameCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
