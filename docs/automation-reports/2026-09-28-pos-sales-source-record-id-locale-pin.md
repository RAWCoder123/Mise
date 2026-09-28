# MISE-005BL: pos_sales.source_record_id cntrl locale pin

Date: 2026-09-28  
Branch: `cursor/mise-pos-sales-source-record-id-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.pos_sales.source_record_id` still accepted any non-null text whose
trimmed length is 1–200 with no control-character rejection. MISE-005U (#429)
pins the `private.prepare_square_sales_for_authority` preflight to
`sale_source_record_id collate "C" ~ '[[:cntrl:]]'` but intentionally does not
reattach this table CHECK. MISE-005I (#417) pinned the sibling
`provider_catalog_item_id` / `provider_location_id` / `provider_variation_id`
CHECKs with COLLATE `"C"` cntrl rejection; `source_record_id` remained
length-only.

`source_record_id` is the durable POS sale identity used by
`UNIQUE (restaurant_id, source_pos, source_record_id)` for sale replay. Under
ctype drift, dump/restore and prepare→store continuity can disagree on the same
sale identity bytes.

## Fix

Additive migration
`20260928110000_mise_005bl_pos_sales_source_record_id_locale_pin.sql`
reattaches `pos_sales_source_record_id_check`:

```sql
source_record_id is null
or (
  length(trim(source_record_id)) between 1 and 200
  and source_record_id collate "C" !~ '[[:cntrl:]]'
)
```

## Out of scope

- Does not rewrite `private.prepare_square_sales_for_authority` (open #429)
- Does not rewrite pos_sales provider-identity CHECKs (open #417)
- Does not touch `selected_modifier_ids`, inventory_events, activity_events, or
  restaurant_memories

## Compose

Compose-safe alone on main. Prefer after MISE-005U (#429) so prepare + CHECK
pins land together; timestamp after MISE-005BK (#471).

## Verification

- `npm run typecheck`
- focused `tests/posSalesSourceRecordIdLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here when Docker unavailable
