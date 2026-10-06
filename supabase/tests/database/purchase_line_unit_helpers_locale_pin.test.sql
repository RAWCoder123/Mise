-- MISE-005IX: purchase-line unit helpers must fold unit case under COLLATE "C"
-- so restore cannot flip pack_unit_dimension_conflict confidence.
-- Plan derived from assertion call sites below (count select is/ok/matches).
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'purchase_line_unit_dimension'
      and pg_get_function_identity_arguments(oid) = 'text'
  ),
  'private.purchase_line_unit_dimension(text) exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'purchase_line_pack_unit'
      and pg_get_function_identity_arguments(oid) = 'text'
  ),
  'private.purchase_line_pack_unit(text) exists'
);

select matches(
  pg_get_functiondef(
    'private.purchase_line_unit_dimension(text)'::regprocedure
  ),
  'lower\(coalesce\(p_unit, ''''\) collate "C"\)',
  'purchase_line_unit_dimension folds unit under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.purchase_line_pack_unit(text)'::regprocedure
  ),
  'lower\(coalesce\(p_pack_size, ''''\) collate "C"\)',
  'purchase_line_pack_unit folds pack size under COLLATE C'
);

select is(
  private.purchase_line_unit_dimension('OZ'),
  'mass',
  'ASCII case-folded mass unit resolves'
);

select is(
  private.purchase_line_unit_dimension('  Gal  '),
  'volume',
  'trimmed mixed-case volume unit resolves'
);

select is(
  private.purchase_line_unit_dimension('CASE'),
  null,
  'package counting word still has no mass/volume dimension'
);

select is(
  private.purchase_line_pack_unit('12x32OZ'),
  'oz',
  'trailing pack unit folds under COLLATE C'
);

select is(
  private.purchase_line_pack_unit('6/1GAL'),
  'gal',
  'mixed-case trailing pack unit folds under COLLATE C'
);

select is(
  private.purchase_line_unit_dimension(
    private.purchase_line_pack_unit('12x32OZ')
  ),
  'mass',
  'pack unit then dimension stay mass under COLLATE C'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.purchase_line_unit_dimension(text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on purchase_line_unit_dimension'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.purchase_line_pack_unit(text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on purchase_line_pack_unit'
);

select * from finish();
rollback;
