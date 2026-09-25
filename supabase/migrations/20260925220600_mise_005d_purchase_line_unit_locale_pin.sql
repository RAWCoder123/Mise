-- MISE-005D: pin purchase-line unit/pack helpers to one locale.
--
-- private.purchase_line_unit_dimension / purchase_line_pack_unit were declared
-- IMMUTABLE, but bare lower() follows database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A demonstrated that lower() differs between
-- en_US.UTF-8 and C for accented uppercase input.
--
-- These helpers only feed ingest-time consistency flags
-- (pack_unit_dimension_conflict). They do not back a CHECK or UNIQUE on stored
-- keys, so there is no pg_dump/restore abort hazard and no backfill. They are
-- still pinned so flag classification cannot drift across ctype changes or
-- diverge from the TypeScript mirror, which now lowercases A-Z only to match
-- lower(... COLLATE "C").

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
    pg_catalog.lower(p_unit collate "C") collate "C"
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
    pg_catalog.lower(p_pack_size collate "C") collate "C",
    '([a-z]+)$'
  ))[1];
$$;

revoke all on function private.purchase_line_unit_dimension(text)
from public, anon, authenticated, service_role;
revoke all on function private.purchase_line_pack_unit(text)
from public, anon, authenticated, service_role;

comment on function private.purchase_line_unit_dimension(text) is
  'Locale-stable mass/volume classifier for purchase-line consistency flags. lower(... COLLATE "C"); never purchasing authority.';
comment on function private.purchase_line_pack_unit(text) is
  'Locale-stable trailing unit token from a pack size. lower(... COLLATE "C") + ASCII [a-z]; never purchasing authority.';
