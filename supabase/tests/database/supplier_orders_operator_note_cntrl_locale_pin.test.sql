-- MISE-005EM: public.supplier_orders.operator_note CHECK must keep its
-- exact length bound and pin multiline-aware ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept note bytes the
-- restored C-locale gate would refuse, while still allowing LF/TAB/CR.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_operator_note_length_check'
  ),
  'supplier_orders_operator_note_length_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_operator_note_length_check'
  ),
  'length\(operator_note\) <= 2000',
  'operator_note CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_operator_note_length_check'
  ),
  'operator_note is null',
  'operator_note CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_orders'::regclass
      and conname = 'supplier_orders_operator_note_length_check'
  ),
  'operator_note collate "C" !~',
  'operator_note CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Leave at back door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable operator note text is accepted under COLLATE C'
);

select is(
  (E'Leave at\nback door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in operator note text is accepted under multiline-aware gate'
);

select is(
  (E'Leave at\tback door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in operator note text is accepted under multiline-aware gate'
);

select is(
  (E'Leave at\rback door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in operator note text is accepted under multiline-aware gate'
);

select is(
  (E'Leave at\x08back door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in operator note text is rejected under COLLATE C'
);

select is(
  (E'Leave at\x0bback door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in operator note text is rejected under COLLATE C'
);

select is(
  (E'Leave at\u007fback door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in operator note text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Leave at back door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Leave at\nback door' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Leave at\x0bback door' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Leave at\u007fback door' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'operator note multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Leave at\tback door'),
      ('Leave at back door'),
      (E'Leave at\nback door'),
      (E'Leave at\rback door'),
      (E'Leave at\x0bback door'),
      (E'Leave at\u007fback door')
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
