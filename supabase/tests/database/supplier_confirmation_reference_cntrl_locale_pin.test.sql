-- MISE-005GN: public.supplier_order_confirmations.confirmation_reference CHECK
-- must keep its null-or-length(trim) 1..512 bound and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept
-- confirmation_reference bytes the restored C-locale gate would refuse.
-- Column is nullable. Sibling status / idempotency / source CHECKs stay on
-- separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_confirmation_reference_check'
  ),
  'supplier_order_confirmations_confirmation_reference_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_confirmation_reference_check'
  ),
  'confirmation_reference is null',
  'supplier_order_confirmations confirmation_reference CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_confirmation_reference_check'
  ),
  'length\(trim\(confirmation_reference\)\) between 1 and 512',
  'supplier_order_confirmations confirmation_reference CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_confirmation_reference_check'
  ),
  'confirmation_reference collate "C" !~ ''[[:cntrl:]]''',
  'supplier_order_confirmations confirmation_reference CHECK uses COLLATE C cntrl rejection'
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
      and conname = 'supplier_order_confirmations_confirmation_reference_check'
    limit 1
  ) ilike '%confirmation_status%',
  false,
  'confirmation_reference CHECK stays dedicated (excludes confirmation_status)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('PO-ACK-88421' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable vendor confirmation reference is accepted under COLLATE C'
);

select is(
  (E'PO\tACK-88421' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in confirmation reference is rejected under COLLATE C'
);

select is(
  (E'PO\nACK-88421' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in confirmation reference is rejected under COLLATE C'
);

select is(
  (E'PO\u007fACK-88421' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in confirmation reference is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('PO-ACK-88421' collate "C" !~ '[[:cntrl:]]')
    and (E'PO\tACK-88421' collate "C" ~ '[[:cntrl:]]')
    and (E'PO\nACK-88421' collate "C" ~ '[[:cntrl:]]')
    and (E'PO\u007fACK-88421' collate "C" ~ '[[:cntrl:]]'),
  true,
  'confirmation reference control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'PO\tACK-88421'),
      ('PO-ACK-88421'),
      (E'PO\nACK-88421'),
      (E'PO\u007fACK-88421')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and contype = 'c'
      and conname = 'supplier_order_confirmations_confirmation_reference_check'
  ),
  1::bigint,
  'exactly one confirmation_reference_check constraint is attached'
);

select * from finish();
rollback;
