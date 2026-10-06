-- MISE-005IS: public.supplier_delivery_items.discrepancy_reason CHECK must
-- keep the exact nullability + length <= 500 bound and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept discrepancy
-- reason bytes the restored C-locale gate would refuse.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_reason_bound_check'
  ),
  'supplier_delivery_items_reason_bound_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_reason_bound_check'
  ),
  'length\(discrepancy_reason\) <= 500',
  'discrepancy_reason CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_reason_bound_check'
  ),
  'discrepancy_reason collate "C" !~ ''[[:cntrl:]]''',
  'discrepancy_reason CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_reason_bound_check'
  ),
  'discrepancy_reason is null',
  'discrepancy_reason CHECK keeps nullability'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('shorted 2 cases' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable discrepancy reason is accepted under COLLATE C'
);

select is(
  (E'shorted\t2 cases' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in discrepancy reason is rejected under COLLATE C'
);

select is(
  (E'shorted\n2 cases' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in discrepancy reason is rejected under COLLATE C'
);

select is(
  (E'shorted\u007f2 cases' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in discrepancy reason is rejected under COLLATE C'
);

select is(
  ('shorted 2 cases' collate "C" !~ '[[:cntrl:]]')
    and (E'shorted\t2 cases' collate "C" ~ '[[:cntrl:]]')
    and (E'shorted\u007f2 cases' collate "C" ~ '[[:cntrl:]]'),
  true,
  'discrepancy reason control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'shorted\t2 cases'),
      ('shorted 2 cases'),
      (E'shorted\n2 cases'),
      (E'shorted\u007f2 cases')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
