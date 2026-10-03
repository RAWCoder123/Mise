# MISE-005FX: purchase_recommendations.item_name cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `purchase_recommendations.item_name` labels:

- Reattach `purchase_recommendations_operational_values_check` preserving exact length and quantity bounds.
- Add `item_name collate "C" !~ '[[:cntrl:]]'`.
- Classified as single-line purchase-recommendation display labels (inventory item name snapshot; not free-form multiline prose).
- Does not rewrite recommendation writers or tip sibling supplier_name / unit / reason, pos_sales.item_name, or inventory_count_lines.item_name.

## Dependencies

- Alone-OK relative to the inventory_items cntrl stack (#585–#587). Timestamp ordered after #587 for migration sequencing only.

## Verification

- `npm run typecheck`
- focused `purchaseRecommendationsItemNameCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
