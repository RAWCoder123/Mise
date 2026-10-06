-- MISE-005IV: canonical-unit conversion IMMUTABLE helpers must fold case under
-- COLLATE "C" so restore cannot remap stored unit tokens the source accepted.
-- Plan derived from assertion call sites below (count select is/ok/matches/isnt).
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'canonical_unit_for_standard_unit'
      and pg_get_function_identity_arguments(oid) = 'text'
  ),
  'private.canonical_unit_for_standard_unit(text) exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'canonical_quantity_per_standard_unit'
      and pg_get_function_identity_arguments(oid) = 'text'
  ),
  'private.canonical_quantity_per_standard_unit(text) exists'
);

select matches(
  pg_get_functiondef('private.canonical_unit_for_standard_unit(text)'::regprocedure),
  'lower\(.*btrim\(coalesce\(p_unit, ''''\)\) collate "C"\)',
  'canonical_unit_for_standard_unit folds case under COLLATE C'
);

select matches(
  pg_get_functiondef('private.canonical_quantity_per_standard_unit(text)'::regprocedure),
  'lower\(.*btrim\(coalesce\(p_unit, ''''\)\) collate "C"\)',
  'canonical_quantity_per_standard_unit folds case under COLLATE C'
);

select is(
  private.canonical_unit_for_standard_unit('KILOGRAMS'),
  'g',
  'ASCII upper mass unit maps to g under COLLATE C fold'
);

select is(
  private.canonical_unit_for_standard_unit('  Lb  '),
  'g',
  'trimmed mixed-case mass unit maps to g under COLLATE C fold'
);

select is(
  private.canonical_unit_for_standard_unit('FL OZ'),
  'ml',
  'ASCII upper volume unit maps to ml under COLLATE C fold'
);

select is(
  private.canonical_quantity_per_standard_unit('KG'),
  1000::numeric,
  'ASCII upper kg quantity stays 1000 under COLLATE C fold'
);

select is(
  private.canonical_quantity_per_standard_unit('oz'),
  28.349523125::numeric,
  'ounce quantity stays exact under COLLATE C fold'
);

select is(
  private.canonical_unit_for_standard_unit('case'),
  null,
  'non-standard package unit still fails closed'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.canonical_unit_for_standard_unit(text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on canonical_unit_for_standard_unit'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.canonical_quantity_per_standard_unit(text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on canonical_quantity_per_standard_unit'
);

select * from finish();
rollback;
