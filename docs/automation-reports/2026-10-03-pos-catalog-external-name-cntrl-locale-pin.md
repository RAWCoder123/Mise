# MISE-005GH: pos_catalog_item_mappings.external_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`pos_catalog_item_mappings_external_name_check` as
`length(trim(external_name)) between 1 and 160` plus
`external_name collate "C" !~ '[[:cntrl:]]'`.

`pos_catalog_item_mappings.external_name` was NOT NULL text with no
table-level length or control gate. Square catalog sync writers persist
`left(trim(...external_name...), 160)` and skip empty results. Open tip
#467 (MISE-005BG) pinned only mapping identity ids
(`external_catalog_item_id` / `external_variation_id`); this tip closes the
remaining ungated mapping label without reattaching those identity CHECKs
or the window / verification / confidence CHECKs, so it stays alone-OK
versus #467 and versus menu_items.name (#597) /
inventory/pos_sales/purchase/count-line stacks.

Classification: single-line POS catalog item labels (not multiline
free-form prose).

## Scope

- CHECK-only; does not rewrite Square sync / POS catalog / mapping-review
  writers
- Does not reattach identity CHECKs (#467) or window/verification/confidence
  CHECKs
- Leaves sibling item_name / menu_items.name stacks untouched

## Verification

- `npm run typecheck`
- focused `posCatalogExternalNameCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
