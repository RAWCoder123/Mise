-- MISE-005GW: public.restaurant_autonomy_rules.supplier_name CHECK must keep
-- its null-or-length(trim) 1..160 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept supplier_name bytes the restored
-- C-locale gate would refuse. Sibling supplier_scope_check /
-- execute_guard / operational_category / communication_type stay on separate
-- constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_supplier_name_check'
  ),
  'restaurant_autonomy_rules_supplier_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_supplier_name_check'
  ),
  'length\(trim\(supplier_name\)\) between 1 and 160',
  'restaurant_autonomy_rules supplier_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_supplier_name_check'
  ),
  'supplier_name collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_autonomy_rules supplier_name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and contype = 'c'
      and conname = 'restaurant_autonomy_rules_supplier_scope_check'
  ),
  'restaurant_autonomy_rules supplier_scope_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and contype = 'c'
      and conname = 'restaurant_autonomy_rules_supplier_name_check'
    limit 1
  ) ilike '%supplier_id%',
  false,
  'supplier_name CHECK stays dedicated (excludes supplier_id / scope_check)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Sysco Fresh' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable autonomy-rule supplier_name is accepted under COLLATE C'
);

select is(
  (E'Sysco\tFresh' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in autonomy-rule supplier_name is rejected under COLLATE C'
);

select is(
  (E'Sysco\nFresh' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in autonomy-rule supplier_name is rejected under COLLATE C'
);

select is(
  (E'Sysco\u0000Fresh' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in autonomy-rule supplier_name is rejected under COLLATE C'
);

select is(
  (E'Sysco\u007fFresh' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in autonomy-rule supplier_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Sysco Fresh' collate "C" !~ '[[:cntrl:]]')
    and (E'Sysco\tFresh' collate "C" ~ '[[:cntrl:]]')
    and (E'Sysco\nFresh' collate "C" ~ '[[:cntrl:]]')
    and (E'Sysco\u007fFresh' collate "C" ~ '[[:cntrl:]]'),
  true,
  'autonomy-rule supplier_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Sysco\tFresh'),
      ('Sysco Fresh'),
      (E'Sysco\nFresh'),
      (E'Sysco\u007fFresh')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_supplier_name_check'
  ),
  'between 1 and 160',
  'restaurant_autonomy_rules supplier_name CHECK keeps original length window'
);

select * from finish();
rollback;
