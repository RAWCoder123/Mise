# MISE-005FV: inventory_items.unit cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `inventory_items.unit` labels:

- Reattach `inventory_items_operational_values_check` preserving exact length and numeric bounds.
- Preserve MISE-005FU `item_name collate "C" !~ '[[:cntrl:]]'`.
- Add `unit collate "C" !~ '[[:cntrl:]]'`.
- Classified as single-line inventory unit-of-measure labels (not free-form multiline prose).
- Does not pin `supplier_name` cntrl in this tip.

## Verification

- `npm run typecheck`
- focused `inventoryItemsUnitCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
