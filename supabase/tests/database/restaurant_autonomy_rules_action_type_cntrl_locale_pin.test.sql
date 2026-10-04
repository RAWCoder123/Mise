-- MISE-005GY: public.restaurant_autonomy_rules.action_type CHECK must
-- keep its length(trim) 1..120 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept action_type bytes the
-- restored C-locale gate would refuse. Column is NOT NULL. Sibling
-- execute_guard / communication_type / supplier_name / supplier_scope /
-- operational_category stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_action_type_check'
  ),
  'restaurant_autonomy_rules_action_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_action_type_check'
  ),
  'length\(trim\(action_type\)\) between 1 and 120',
  'restaurant_autonomy_rules action_type CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and conname = 'restaurant_autonomy_rules_action_type_check'
  ),
  'action_type collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_autonomy_rules action_type CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and contype = 'c'
      and conname = 'restaurant_autonomy_rules_execute_guard'
  ),
  'restaurant_autonomy_rules execute_guard remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_autonomy_rules'::regclass
      and contype = 'c'
      and conname = 'restaurant_autonomy_rules_action_type_check'
    limit 1
  ) ilike '%execute%',
  false,
  'action_type CHECK stays dedicated (excludes execute_guard / siblings)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('send_supplier_order' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable autonomy-rule action_type is accepted under COLLATE C'
);

select is(
  (E'send\tsupplier_order' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in autonomy-rule action_type is rejected under COLLATE C'
);

select is(
  (E'send\nsupplier_order' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in autonomy-rule action_type is rejected under COLLATE C'
);

select is(
  (E'send\u0000supplier_order' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in autonomy-rule action_type is rejected under COLLATE C'
);

select is(
  (E'send\u007fsupplier_order' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in autonomy-rule action_type is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('send_supplier_order' collate "C" !~ '[[:cntrl:]]')
    and (E'send\tsupplier_order' collate "C" ~ '[[:cntrl:]]')
    and (E'send\nsupplier_order' collate "C" ~ '[[:cntrl:]]')
    and (E'send\u007fsupplier_order' collate "C" ~ '[[:cntrl:]]'),
  true,
  'autonomy-rule action_type control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'send\tsupplier_order'),
      ('send_supplier_order'),
      (E'send\nsupplier_order'),
      (E'send\u007fsupplier_order')
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
      and conname = 'restaurant_autonomy_rules_action_type_check'
  ),
  'between 1 and 120',
  'restaurant_autonomy_rules action_type CHECK keeps original length window'
);

select * from finish();
rollback;
