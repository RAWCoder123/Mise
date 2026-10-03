# MISE-005FY: purchase_recommendations.supplier_name cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `purchase_recommendations.supplier_name` labels:

- Reattach `purchase_recommendations_operational_values_check` preserving exact length and quantity bounds.
- Preserve MISE-005FX (#588) `item_name collate "C" !~ '[[:cntrl:]]'`.
- Add `supplier_name collate "C" !~ '[[:cntrl:]]'`.
- Classified as single-line purchase-recommendation display labels (preferred-supplier name snapshot; not free-form multiline prose).
- Does not rewrite recommendation writers or tip sibling unit / reason, pos_sales.item_name, or inventory_count_lines.item_name.

## Dependencies

- Land after #588 (`purchase_recommendations.item_name`) so the shared CHECK reattach preserves that pin.
- Alone-OK relative to the inventory_items cntrl stack (#585–#587). Timestamp ordered after #588 for migration sequencing.

## Verification

- `npm run typecheck`
- focused `purchaseRecommendationsSupplierNameCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
