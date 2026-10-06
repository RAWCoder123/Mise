-- MISE-005IW: pin private.purchase_units_compatible IMMUTABLE case folding to
-- COLLATE "C".
--
-- MISE-003A declared purchase_units_compatible IMMUTABLE but its recipe/item
-- unit equality still uses bare lower(trim(...)). Bare lower() follows
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster for lower() and POSIX classes.
--
-- This helper gates recipe-authority readiness and purchase-approval recipe
-- unit compatibility (recipe_unit_incompatible). It also calls
-- private.canonical_unit_for_standard_unit, which MISE-005IV pins separately.
-- If LC_CTYPE drifted under bare lower(), the same stored recipe/item unit
-- tokens could disagree after restore — or fail to match — and flip purchase
-- authority for rows the source accepted.
--
-- Scope:
--   - Rewrite purchase_units_compatible so case folding uses
--     lower(btrim(...) collate "C")
--   - Preserve exact compatibility semantics and EXECUTE revoke
-- Does NOT rewrite canonical_unit_for_standard_unit (#664), supplier-name
-- normalize (#410), or purchase recommendation unit CHECKs.
-- Timestamp after MISE-005IV (#664). Alone-OK on main.

create or replace function private.purchase_units_compatible(
  p_recipe_unit text,
  p_item_unit text,
  p_item_canonical_unit text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
      pg_catalog.lower(
        pg_catalog.btrim(coalesce(p_recipe_unit, '')) collate "C"
      ),
      ''
    ) is not null
    and (
      pg_catalog.lower(
        pg_catalog.btrim(coalesce(p_recipe_unit, '')) collate "C"
      ) = pg_catalog.lower(
        pg_catalog.btrim(coalesce(p_item_unit, '')) collate "C"
      )
      or (
        private.canonical_unit_for_standard_unit(p_recipe_unit) is not null
        and private.canonical_unit_for_standard_unit(p_recipe_unit)
          = p_item_canonical_unit
      )
    );
$$;

revoke all on function private.purchase_units_compatible(text, text, text)
  from public, anon, authenticated, service_role;

comment on function private.purchase_units_compatible(text, text, text) is
  'MISE-005IW: recipe/item unit compatibility under COLLATE "C" case folding.';
