-- MISE-005GX: public.restaurant_autonomy_rules.communication_type CHECK must
-- keep its null-or-length(trim) 1..80 bound and pin ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept communication_type bytes the
-- restored C-locale gate would refuse. Sibling supplier_scope_check /
-- execute_guard / operational_category / supplier_name stay on separate
-- constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_communication_type_check'
  ),
  'restaurant_autonomy_rules_communication_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_communication_type_check'
  ),
  'length\(trim\(communication_type\)\) between 1 and 80',
  'restaurant_autonomy_rules communication_type CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_communication_type_check'
  ),
  'communication_type collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_autonomy_rules communication_type CHECK uses COLLATE C cntrl rejection'
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
      and conname = 'restaurant_autonomy_rules_communication_type_check'
    limit 1
  ) ilike '%supplier_name%',
  false,
  'communication_type CHECK stays dedicated (excludes supplier_name / scope siblings)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('email' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable autonomy-rule communication_type is accepted under COLLATE C'
);

select is(
  (E'email\tchannel' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in autonomy-rule communication_type is rejected under COLLATE C'
);

select is(
  (E'email\nchannel' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in autonomy-rule communication_type is rejected under COLLATE C'
);

select is(
  (E'email\u0000channel' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in autonomy-rule communication_type is rejected under COLLATE C'
);

select is(
  (E'email\u007fchannel' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in autonomy-rule communication_type is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('email' collate "C" !~ '[[:cntrl:]]')
    and (E'email\tchannel' collate "C" ~ '[[:cntrl:]]')
    and (E'email\nchannel' collate "C" ~ '[[:cntrl:]]')
    and (E'email\u007fchannel' collate "C" ~ '[[:cntrl:]]'),
  true,
  'autonomy-rule communication_type control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'email\tchannel'),
      ('email'),
      (E'email\nchannel'),
      (E'email\u007fchannel')
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
      and conname = 'restaurant_autonomy_rules_communication_type_check'
  ),
  'between 1 and 80',
  'restaurant_autonomy_rules communication_type CHECK keeps original length window'
);

select * from finish();
rollback;
