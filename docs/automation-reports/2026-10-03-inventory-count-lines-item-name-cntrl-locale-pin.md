# MISE-005GB: inventory_count_lines.item_name cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `inventory_count_lines.item_name` snapshot labels:

- Reattach `inventory_count_lines_item_name_check` preserving exact `char_length(btrim(item_name)) between 1 and 160`.
- Add `item_name collate "C" !~ '[[:cntrl:]]'`.
- Leave `unit` length-only on its sibling CHECK (tip separately).
- Classified as single-line inventory count snapshot labels copied from `inventory_items.item_name` (not free-form multiline prose).
- Does not rewrite count-session RPCs, notes (#552), or inventory_items / pos_sales / purchase_recommendations stacks.

## Dependencies

- Alone-OK vs inventory_items (#585–#587), purchase_recommendations (#588–#590), and pos_sales.item_name (#591).
- Timestamp ordered after #591 for migration sequencing.

## Verification

- `npm run typecheck`
- focused `inventoryCountLinesItemNameCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
