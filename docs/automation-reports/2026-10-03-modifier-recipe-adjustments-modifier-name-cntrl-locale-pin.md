# MISE-005GL: modifier_recipe_adjustments.modifier_name cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`modifier_recipe_adjustments_modifier_name_check` as
`length(trim(modifier_name)) between 1 and 160` plus
`modifier_name collate "C" !~ '[[:cntrl:]]'`.

`modifier_recipe_adjustments.modifier_name` was NOT NULL text with no
table-level length or control gate. Open manager-authority writers (#341)
reject empty names and refuse `char_length > 160` after btrim
(`MAX_MODIFIER_NAME_LENGTH = 160`) but never reject control characters.
This tip closes the ungated POS modifier label without reattaching
`external_modifier_id` (#468), `verification_status` (#493), or
`canonical_unit` (#491) bounds, so it stays alone-OK versus those tips.

Classification: single-line POS modifier labels (not multiline free-form
prose).

## Scope

- CHECK-only; does not rewrite upsert/verify/reject/expire RPCs (#341)
- Does not rewrite Square modifier sync (#342) or depletion (#344)
- Does not reattach external_modifier_id / verification_status /
  canonical_unit bounds

## Verification

- `npm run typecheck`
- focused `modifierRecipeAdjustmentsModifierNameCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
