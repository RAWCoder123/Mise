-- MISE-005HC: public.supplier_orders.order_message CHECK must keep its
-- exact octet_length bound and pin multiline-aware ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept body bytes the
-- restored C-locale gate would refuse, while still allowing LF/TAB/CR.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_message_size_check'
  ),
  'supplier_orders_message_size_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_message_size_check'
  ),
  'octet_length\(order_message\) <= 65536',
  'order_message CHECK keeps exact octet_length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_message_size_check'
  ),
  'order_message collate "C" !~',
  'order_message CHECK uses COLLATE C control rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_operational_values_check'
  ),
  'supplier_orders operational_values_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid) ilike '%[[:cntrl:]]%'
      or pg_get_constraintdef(oid) ilike E'%\\x00-\\x08%'
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_operational_values_check'
  ),
  false,
  'supplier_orders operational_values_check still excludes order_message cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Please deliver apples.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable order_message text is accepted under COLLATE C'
);

select is(
  (E'Please deliver:\n- Apples' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in order_message text is accepted under multiline-aware gate'
);

select is(
  (E'Please deliver:\tApples' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in order_message text is accepted under multiline-aware gate'
);

select is(
  (E'Please deliver:\rApples' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in order_message text is accepted under multiline-aware gate'
);

select is(
  (E'Please deliver:\x08Apples' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in order_message text is rejected under COLLATE C'
);

select is(
  (E'Please deliver:\x0bApples' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in order_message text is rejected under COLLATE C'
);

select is(
  (E'Please deliver:\u007fApples' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in order_message text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Please deliver apples.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Please deliver:\n- Apples' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Please deliver:\x0bApples' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Please deliver:\u007fApples' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'order_message multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Please deliver:\tApples'),
      ('Please deliver apples.'),
      (E'Please deliver:\n- Apples'),
      (E'Please deliver:\rApples'),
      (E'Please deliver:\x0bApples'),
      (E'Please deliver:\u007fApples')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'multiline ASCII control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
