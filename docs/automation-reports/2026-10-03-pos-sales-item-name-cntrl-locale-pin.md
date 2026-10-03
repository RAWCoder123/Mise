# MISE-005GA: pos_sales.item_name cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `pos_sales.item_name` labels:

- Reattach `pos_sales_operational_values_check` preserving exact length (`item_name` 1–200, `category` 1–120) and quantity/amount bounds (`quantity_sold > 0` and `<= 100000`, `gross_sales`/`net_sales` 0–10000000).
- Add `item_name collate "C" !~ '[[:cntrl:]]'`.
- Leave `category` length-only on the shared CHECK (sibling tip if needed).
- Classified as single-line POS sale/catalog display labels (not free-form multiline prose).
- Does not rewrite POS sync/setup writers or tip `inventory_count_lines.item_name`.

## Dependencies

- Alone-OK vs inventory_items (#585–#587) and purchase_recommendations (#588–#590) stacks.
- Timestamp ordered after #590 for migration sequencing.

## Verification

- `npm run typecheck`
- focused `posSalesItemNameCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
