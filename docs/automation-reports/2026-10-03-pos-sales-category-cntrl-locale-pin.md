# MISE-005GD: pos_sales.category cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `pos_sales.category` labels:

- Reattach `pos_sales_operational_values_check` preserving exact length (`item_name` 1–200, `category` 1–120) and quantity/amount bounds (`quantity_sold > 0` and `<= 100000`, `gross_sales`/`net_sales` 0–10000000).
- Preserve MISE-005GA `item_name collate "C" !~ '[[:cntrl:]]'`.
- Add `category collate "C" !~ '[[:cntrl:]]'`.
- Classified as single-line POS sale/catalog category labels (not free-form multiline prose).
- Does not rewrite POS sync/setup writers or tip inventory_count_lines / inventory_items / purchase_recommendations stacks.

## Dependencies

- Land after #591 (`pos_sales.item_name`) so reattach preserves item_name cntrl.
- Alone-OK vs inventory_items (#585–#587), purchase_recommendations (#588–#590), and inventory_count_lines (#592/#593) stacks.
- Timestamp ordered after #593 for migration sequencing.
- When rebasing onto #591, drop that tip’s “category remains without cntrl” assertions.

## Verification

- `npm run typecheck`
- focused `posSalesCategoryCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
