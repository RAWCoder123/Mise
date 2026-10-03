# MISE-005GK: pos_locations.display_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`pos_locations_display_name_check` as
`length(trim(display_name)) between 1 and 200` plus
`display_name collate "C" !~ '[[:cntrl:]]'`.

`pos_locations.display_name` was NOT NULL text with no table-level
length or control gate. Square OAuth/location sync writers persist
`left(..., 200)` / `stringField(..., 200)` and skip empty display names.
This tip closes the ungated POS location label without reattaching the
status CHECK or touching `external_location_id` / catalog external_name
(#598) / sibling item_name stacks, so it stays alone-OK versus those tips.

Classification: single-line POS location labels (not multiline free-form
prose).

## Scope

- CHECK-only; does not rewrite Square OAuth / location sync writers
- Does not reattach status CHECK or external_location_id bounds
- Leaves sibling catalog / inventory / sales / purchase stacks untouched

## Verification

- `npm run typecheck`
- focused `posLocationsDisplayNameCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
