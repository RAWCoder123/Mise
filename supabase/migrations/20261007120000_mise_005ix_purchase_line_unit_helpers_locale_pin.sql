-- MISE-005IX: pin purchase-line unit IMMUTABLE helpers' lower() to COLLATE "C".
--
-- MISE-004C declared private.purchase_line_unit_dimension and
-- private.purchase_line_pack_unit IMMUTABLE, but both still fold unit tokens
-- with bare lower(...). Bare lower() follows database LC_CTYPE. This cluster
-- runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster for
-- lower() and POSIX classes.
--
-- These helpers feed purchase_line_consistency_flags. A mass/volume mismatch
-- between unit_of_measure and the trailing pack-size unit yields
-- pack_unit_dimension_conflict and caps confidence at could_not_verify. If
-- LC_CTYPE drifted under bare lower(), the same stored unit tokens could
-- disagree after restore — or fail to match the fixed ASCII vocabulary —
-- and flip confidence for lines the source accepted.
--
-- Scope:
--   - Rewrite purchase_line_unit_dimension so case folding uses
--     lower(... collate "C")
--   - Rewrite purchase_line_pack_unit so case folding uses
--     lower(... collate "C") before the trailing-letter extract
--   - Preserve exact vocabulary, consistency-flag semantics, and EXECUTE revoke
-- Does NOT rewrite fold_purchase_line_* / normalize_purchase_item_key (already
-- pinned by MISE-005A), purchase_units_compatible (#665), conversion helpers
-- (#664), or supplier-name normalize (#410).
-- Timestamp after MISE-005IW (#665). Alone-OK on main.

create or replace function private.purchase_line_unit_dimension(p_unit text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select dimensions.dimension
  from (values
    ('g','mass'),('gram','mass'),('grams','mass'),('kg','mass'),('kgs','mass'),
    ('mg','mass'),('mgs','mass'),('lb','mass'),('lbs','mass'),('oz','mass'),('ozs','mass'),
    ('ml','volume'),('l','volume'),('lt','volume'),('ltr','volume'),
    ('liter','volume'),('liters','volume'),('litre','volume'),('litres','volume'),
    ('gal','volume'),('gals','volume'),('gallon','volume'),('gallons','volume'),
    ('qt','volume'),('qts','volume'),('quart','volume'),('quarts','volume'),
    ('pt','volume'),('pts','volume'),('pint','volume'),('pints','volume')
  ) as dimensions(unit, dimension)
  where dimensions.unit = pg_catalog.btrim(
    pg_catalog.lower(coalesce(p_unit, '') collate "C")
  );
$$;

create or replace function private.purchase_line_pack_unit(p_pack_size text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select (pg_catalog.regexp_match(
    pg_catalog.lower(coalesce(p_pack_size, '') collate "C"),
    '([a-z]+)$'
  ))[1];
$$;

revoke all on function private.purchase_line_unit_dimension(text)
  from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_pack_unit(text)
  from public, anon, authenticated, service_role;

comment on function private.purchase_line_unit_dimension(text) is
  'MISE-005IX: mass/volume dimension lookup under COLLATE "C" case folding.';
comment on function private.purchase_line_pack_unit(text) is
  'MISE-005IX: trailing pack-size unit extract under COLLATE "C" case folding.';
