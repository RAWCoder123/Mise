-- MISE-005IV: pin inventory canonical-unit conversion IMMUTABLE helpers to
-- COLLATE "C" for case folding.
--
-- private.canonical_unit_for_standard_unit (inventory_item_canonical_unit_authority)
-- and private.canonical_quantity_per_standard_unit (inventory_canonical_conversion_projection)
-- were declared IMMUTABLE but still use bare lower(trim(...)). Bare lower()
-- follows database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster for lower() and POSIX classes.
--
-- These helpers infer verified canonical_unit / canonical_quantity_per_unit on
-- inventory_items (trigger + backfill) and gate purchase-approval recipe-unit
-- compatibility. If LC_CTYPE drifted under bare lower(), the same stored unit
-- token could map to a different canonical dimension or quantity after restore —
-- or fail to map — breaking ledger projection and purchase authority continuity
-- for rows the source accepted.
--
-- Scope:
--   - Rewrite both IMMUTABLE helpers so case folding uses
--     lower(btrim(...) collate "C")
--   - Preserve exact CASE vocabulary and security invoker / search_path
--   - Re-assert EXECUTE revoke from client roles
-- Does NOT reattach canonical_unit CHECKs (#490/#491), rewrite normalize /
-- enforce triggers, or tip supplier-name normalize (#410).
-- Timestamp after MISE-005IU (#663). Alone-OK on main.

create or replace function private.canonical_unit_for_standard_unit(p_unit text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_unit, '')) collate "C")
    when 'g' then 'g'
    when 'gram' then 'g'
    when 'grams' then 'g'
    when 'kg' then 'g'
    when 'kilogram' then 'g'
    when 'kilograms' then 'g'
    when 'oz' then 'g'
    when 'ounce' then 'g'
    when 'ounces' then 'g'
    when 'lb' then 'g'
    when 'lbs' then 'g'
    when 'pound' then 'g'
    when 'pounds' then 'g'
    when 'ml' then 'ml'
    when 'milliliter' then 'ml'
    when 'milliliters' then 'ml'
    when 'l' then 'ml'
    when 'liter' then 'ml'
    when 'liters' then 'ml'
    when 'tsp' then 'ml'
    when 'teaspoon' then 'ml'
    when 'teaspoons' then 'ml'
    when 'tbsp' then 'ml'
    when 'tablespoon' then 'ml'
    when 'tablespoons' then 'ml'
    when 'fl oz' then 'ml'
    when 'fluid ounce' then 'ml'
    when 'fluid ounces' then 'ml'
    when 'each' then 'each'
    when 'ea' then 'each'
    when 'count' then 'each'
    when 'unit' then 'each'
    else null
  end
$$;

create or replace function private.canonical_quantity_per_standard_unit(p_unit text)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_unit, '')) collate "C")
    when 'g' then 1
    when 'gram' then 1
    when 'grams' then 1
    when 'kg' then 1000
    when 'kilogram' then 1000
    when 'kilograms' then 1000
    when 'oz' then 28.349523125
    when 'ounce' then 28.349523125
    when 'ounces' then 28.349523125
    when 'lb' then 453.59237
    when 'lbs' then 453.59237
    when 'pound' then 453.59237
    when 'pounds' then 453.59237
    when 'ml' then 1
    when 'milliliter' then 1
    when 'milliliters' then 1
    when 'l' then 1000
    when 'liter' then 1000
    when 'liters' then 1000
    when 'tsp' then 4.92892159375
    when 'teaspoon' then 4.92892159375
    when 'teaspoons' then 4.92892159375
    when 'tbsp' then 14.78676478125
    when 'tablespoon' then 14.78676478125
    when 'tablespoons' then 14.78676478125
    when 'fl oz' then 29.5735295625
    when 'fluid ounce' then 29.5735295625
    when 'fluid ounces' then 29.5735295625
    when 'each' then 1
    when 'ea' then 1
    when 'count' then 1
    when 'unit' then 1
    else null
  end
$$;

revoke all on function private.canonical_unit_for_standard_unit(text)
  from public, anon, authenticated, service_role;
revoke all on function private.canonical_quantity_per_standard_unit(text)
  from public, anon, authenticated, service_role;

comment on function private.canonical_unit_for_standard_unit(text) is
  'MISE-005IV: map a standard inventory unit token to g/ml/each under COLLATE "C" case folding.';

comment on function private.canonical_quantity_per_standard_unit(text) is
  'MISE-005IV: map a standard inventory unit token to canonical quantity under COLLATE "C" case folding.';
