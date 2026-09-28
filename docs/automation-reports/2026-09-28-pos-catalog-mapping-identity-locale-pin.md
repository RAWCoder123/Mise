# MISE-005BG: pos_catalog_item_mappings identity COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-pos-catalog-mapping-identity-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Add length + cntrl CHECKs under COLLATE `"C"` on
`public.pos_catalog_item_mappings` join-key identity columns:

```text
external_catalog_item_id:
  length between 1 and 128
  and collate "C" !~ '[[:cntrl:]]'

external_variation_id:
  '' (empty-string sentinel)
  or (length between 1 and 128 and collate "C" !~ '[[:cntrl:]]')
```

Empty-string variation remains valid for catalog rows without a variation.
Non-empty values match the sale-side length + cntrl contract on
`pos_sales.provider_catalog_item_id` / `provider_variation_id`
(MISE-002A; open #417 re-pins cntrl under COLLATE `"C"`).

## Why

Catalog mapping rows are the authoritative bridge from POS sales to verified
recipes. The identity columns had no length or charset CHECK while sync
writers only truncate with `left(..., 128)`. Sibling `pos_sales` provider
identity already fails closed on controls; without matching gates on the
mapping table, dump/restore under a drifted `LC_CTYPE` could accept a mapping
identity a restored C-locale sale path would refuse (or the reverse), breaking
sale→mapping→recipe depletion joins.

## Out of scope

- Rewriting Square sync upsert / mapping-review RPCs (open POS sync stacks)
- `pos_sales` provider identity cntrl pin (#417)
- `pos_locations` / `pos_integrations` external_location_id (#465 / #466)
- `modifier_recipe_adjustments.external_modifier_id` (follow-up alone-on-main)
- `external_name` free-form display
- activity_events / restaurant_memories / inventory_events

## Verification

- `npm run typecheck`
- focused: `posCatalogMappingIdentityLocalePin`
- `npm test`
- `npm run supabase:test` blocked locally when Docker unavailable
