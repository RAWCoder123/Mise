-- MISE-005EO: public.supplier_deliveries.notes and
-- public.supplier_delivery_items.discrepancy_reason CHECKs must keep their
-- exact length bounds and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept delivery-note bytes the restored C-locale
-- gate would refuse.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'supplier_deliveries_notes_bound_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'length\(notes\) <= 2000',
  'supplier_deliveries notes CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'notes is null',
  'supplier_deliveries notes CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  'notes collate "C" !~ ''[[:cntrl:]]''',
  'supplier_deliveries notes CHECK uses COLLATE C cntrl rejection'
);

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
  'supplier_delivery_items discrepancy_reason CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_reason_bound_check'
  ),
  'discrepancy_reason is null',
  'supplier_delivery_items discrepancy_reason CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_reason_bound_check'
  ),
  'discrepancy_reason collate "C" !~ ''[[:cntrl:]]''',
  'supplier_delivery_items discrepancy_reason CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Three heads missing from the delivery' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable supplier delivery note text is accepted under COLLATE C'
);

select is(
  (E'Three heads\tmissing' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in supplier delivery note text is rejected under COLLATE C'
);

select is(
  (E'Three heads\nmissing' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in supplier delivery note text is rejected under COLLATE C'
);

select is(
  (E'Three heads\u007fmissing' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in supplier delivery note text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Three heads missing from the delivery' collate "C" !~ '[[:cntrl:]]')
    and (E'Three heads\tmissing' collate "C" ~ '[[:cntrl:]]')
    and (E'Three heads\u007fmissing' collate "C" ~ '[[:cntrl:]]'),
  true,
  'supplier delivery note control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Three heads\tmissing'),
      ('Three heads missing from the delivery'),
      (E'Three heads\nmissing'),
      (E'Three heads\u007fmissing')
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
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_notes_bound_check'
  ),
  '<= 2000',
  'supplier_deliveries notes CHECK keeps original length window'
);

select * from finish();
rollback;
