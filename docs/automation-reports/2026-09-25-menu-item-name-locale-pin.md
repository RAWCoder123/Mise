# MISE-005C: pin menu_items unique name key to COLLATE C

Date: 2026-09-25
Branch: `cursor/mise-menu-item-name-locale-pin`
Base: `origin/main` @ `78da737`

## Problem

`menu_items_restaurant_normalized_name_key` was `unique (restaurant_id, lower(trim(name)))`.
`lower()` follows database LC_CTYPE. MISE-005A proved accented uppercase `lower()`
differs between en_US.UTF-8 and C. That unique index is a restore hazard: a
ctype change that moved recomputed keys would make pg_dump/restore abort on
rows the source accepted.

A naive `lower(... COLLATE "C")` pin is not enough: C only case-folds ASCII A-Z,
so `JALAPEÑO` and `Jalapeño` would become distinct keys. Accents must be folded
before the C lower, same as MISE-005A/005B.

MISE-005A fixed purchase_lines; MISE-005B (#410) fixed suppliers. Menu items
remained.

## Change

- Additive migration `20260925210000_mise_005c_menu_item_name_locale_pin.sql`
- `private.normalize_menu_item_name` = accent-fold (`fold_purchase_line_accents`)
  then `lower(btrim(... COLLATE "C"))`
- Collision backfill suffixes newer rows with ` · ` + id[0:8]
- Unique index recreated on `normalize_menu_item_name(name)`
- `assign_recipe_menu_item_identity` and Square `mise_003a_base` catalog lookup
  retargeted to the same key
- Domain TS parity: `services/domain/menuItemNameNormalization.ts`

## Semantic note

Discovery now treats Café / Cafe as one key (accent fold). Stored `name` keeps
operator-facing accents. Durable `menu_items.id` is unchanged, so recipe and POS
mappings do not move. Collision repair only rewrites display `name` with a
stable id suffix.

## Verification

- `npm run typecheck`
- `npm test` (focused menu normalize + full suite)
- pgTAP file committed (`menu_item_name_locale_pin.test.sql`); Docker/pgTAP
  unavailable in this environment

## Out of scope

- `purchase_line_unit_dimension` / `pg_column_size` / `realtime.to_regrole`
  (remaining MISE-005 siblings)
- Open stacks #348–#410
- Inventing MOQ / lead_time / expiration
