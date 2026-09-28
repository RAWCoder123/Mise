# MISE-005BH: modifier_recipe_adjustments.external_modifier_id COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-modifier-recipe-adjustment-identity-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Add a length + cntrl CHECK under COLLATE `"C"` on
`public.modifier_recipe_adjustments.external_modifier_id`:

```text
length between 1 and 128
and collate "C" !~ '[[:cntrl:]]'
```

Empty values remain rejected (column is NOT NULL; writers already nullif empty
after trim). Non-empty values match the sale-side length + cntrl contract on
`pos_sales.selected_modifier_ids` (open #344) and the catalog mapping identity
bounds introduced in MISE-005BG (#467).

## Why

Verified modifier recipe adjustments are the authoritative bridge from POS
line-item modifiers to inventory deltas. The identity column had no length or
charset CHECK while open #341 writers only reject empty / over-length after
trim. Sibling sale `selected_modifier_ids` already fails closed on controls
(#344); without a matching gate on the adjustment table, dump/restore under a
drifted `LC_CTYPE` could accept a modifier identity a restored C-locale sale
path would refuse (or the reverse), breaking sale→modifier→recipe depletion
joins.

## Out of scope

- Rewriting upsert/verify/reject/expire RPCs (#341)
- Square modifier sync metadata (#342)
- `pos_sales.selected_modifier_ids` / depletion wiring (#344)
- `modifier_name` free-form display
- `pos_catalog_item_mappings` identity (#467)
- activity_events / restaurant_memories / inventory_events

## Verification

- `npm run typecheck`
- focused: `modifierRecipeAdjustmentIdentityLocalePin`
- `npm test`
- `npm run supabase:test` blocked locally when Docker unavailable
