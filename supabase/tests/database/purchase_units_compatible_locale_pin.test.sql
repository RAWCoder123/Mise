-- MISE-005IW: purchase_units_compatible must fold recipe/item unit case under
-- COLLATE "C" so restore cannot flip purchase-authority recipe compatibility.
-- Plan derived from assertion call sites below (count select is/ok/matches).
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'purchase_units_compatible'
      and pg_get_function_identity_arguments(oid) = 'text, text, text'
  ),
  'private.purchase_units_compatible(text, text, text) exists'
);

select matches(
  pg_get_functiondef(
    'private.purchase_units_compatible(text, text, text)'::regprocedure
  ),
  'lower\(.*btrim\(coalesce\(p_recipe_unit, ''''\)\) collate "C"\)',
  'purchase_units_compatible folds recipe unit under COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.purchase_units_compatible(text, text, text)'::regprocedure
  ),
  'lower\(.*btrim\(coalesce\(p_item_unit, ''''\)\) collate "C"\)',
  'purchase_units_compatible folds item unit under COLLATE C'
);

select is(
  private.purchase_units_compatible('OZ', 'oz', 'g'),
  true,
  'ASCII case-folded exact unit match stays compatible'
);

select is(
  private.purchase_units_compatible('  Lb  ', 'lb', 'g'),
  true,
  'trimmed mixed-case exact unit match stays compatible'
);

select is(
  private.purchase_units_compatible('KILOGRAMS', 'kg', 'g'),
  true,
  'exact match after COLLATE C fold stays compatible'
);

select is(
  private.purchase_units_compatible('oz', 'each', 'g'),
  true,
  'canonical-dimension fallback remains compatible when recipe maps to item canonical'
);

select is(
  private.purchase_units_compatible('case', 'each', 'each'),
  false,
  'unknown package unit still fails closed without exact match'
);

select is(
  private.purchase_units_compatible('', 'oz', 'g'),
  false,
  'blank recipe unit still fails closed'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.purchase_units_compatible(text, text, text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on purchase_units_compatible'
);

select * from finish();
rollback;
