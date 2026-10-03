# MISE-005GC: inventory_count_lines.unit cntrl locale pin

Date: 2026-10-03

## Change

CHECK-only locale pin for durable `inventory_count_lines.unit` snapshot labels:

- Reattach `inventory_count_lines_unit_check` preserving exact `char_length(btrim(unit)) between 1 and 40`.
- Add `unit collate "C" !~ '[[:cntrl:]]'`.
- Leave `item_name` on its separate sibling CHECK (tipped in #592).
- Classified as single-line inventory count unit snapshot labels copied from `inventory_items.unit` (not free-form multiline prose).
- Does not rewrite count-session RPCs, notes (#552), or inventory_items / pos_sales / purchase_recommendations stacks.

## Dependencies

- Alone-OK vs inventory_items (#585–#587), purchase_recommendations (#588–#590), pos_sales.item_name (#591), and inventory_count_lines.item_name (#592).
- Timestamp ordered after #592 for migration sequencing.
- When rebasing onto #592, drop that tip’s “unit remains without cntrl” assertions so both tips coexist.

## Verification

- `npm run typecheck`
- focused `inventoryCountLinesUnitCntrlLocalePin`
- `npm test` when available
- pgTAP plan derived from assertion call sites in source
