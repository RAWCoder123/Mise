# MISE-005FW: inventory_items.supplier_name cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `inventory_items.supplier_name` labels:

- Reattach `inventory_items_operational_values_check` preserving exact length and numeric bounds.
- Preserve MISE-005FU `item_name collate "C" !~ '[[:cntrl:]]'`.
- Preserve MISE-005FV `unit collate "C" !~ '[[:cntrl:]]'`.
- Add `supplier_name collate "C" !~ '[[:cntrl:]]'`.
- Classified as single-line inventory preferred-supplier display labels (not free-form multiline prose).
- Does not rewrite setup/save inventory writers or tip sibling item_name columns on other tables.

## Dependencies

- Must land after #585 (MISE-005FU) and #586 (MISE-005FV) because this tip reattaches the shared CHECK with both prior cntrl pins preserved.

## Verification

- `npm run typecheck`
- focused `inventoryItemsSupplierNameCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
