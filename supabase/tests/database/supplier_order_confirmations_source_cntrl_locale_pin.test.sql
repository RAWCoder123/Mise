-- MISE-005GP: public.supplier_order_confirmations.source CHECK must keep its
-- exact length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept source bytes the restored C-locale gate would
-- refuse. Sibling status / idempotency / details CHECKs stay on separate
-- constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_source_check'
  ),
  'supplier_order_confirmations_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_source_check'
  ),
  'length\(trim\(source\)\) between 1 and 80',
  'supplier_order_confirmations source CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_source_check'
  ),
  'source collate "C" !~ ''[[:cntrl:]]''',
  'supplier_order_confirmations source CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and contype = 'c'
      and (
        conname = 'supplier_order_confirmations_confirmation_status_check'
        or pg_get_constraintdef(oid) ilike '%confirmation_status%'
      )
  ),
  'supplier_order_confirmations confirmation_status CHECK remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and contype = 'c'
      and conname = 'supplier_order_confirmations_source_check'
    limit 1
  ) ilike '%confirmation_status%',
  false,
  'source CHECK stays dedicated (excludes confirmation_status)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('gmail' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable confirmation source is accepted under COLLATE C'
);

select is(
  (E'gmail\tmanual' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in confirmation source is rejected under COLLATE C'
);

select is(
  (E'gmail\nmanual' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in confirmation source is rejected under COLLATE C'
);

select is(
  (E'gmail\u007fmanual' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in confirmation source is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('gmail' collate "C" !~ '[[:cntrl:]]')
    and (E'gmail\tmanual' collate "C" ~ '[[:cntrl:]]')
    and (E'gmail\nmanual' collate "C" ~ '[[:cntrl:]]')
    and (E'gmail\u007fmanual' collate "C" ~ '[[:cntrl:]]'),
  true,
  'confirmation source control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'gmail\tmanual'),
      ('gmail'),
      (E'gmail\nmanual'),
      (E'gmail\u007fmanual')
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
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_source_check'
  ),
  'between 1 and 80',
  'supplier_order_confirmations source CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and contype = 'c'
      and conname = 'supplier_order_confirmations_source_check'
  ),
  1::bigint,
  'exactly one source_check constraint is attached'
);

select * from finish();
rollback;
