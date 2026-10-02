-- MISE-005FR: public.sales_imports.error_message CHECK must keep
-- its null-or-length(trim) 1..200 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept error_message bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_error_message_check'
  ),
  'sales_imports_error_message_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_error_message_check'
  ),
  'error_message is null',
  'sales_imports error_message CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_error_message_check'
  ),
  'length\(trim\(error_message\)\) between 1 and 200',
  'sales_imports error_message CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_error_message_check'
  ),
  'error_message collate "C" !~ ''[[:cntrl:]]''',
  'sales_imports error_message CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('square_sync_rate_limited' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable sales_imports error_message is accepted under COLLATE C'
);

select is(
  (E'square\tsync_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in sales_imports error_message is rejected under COLLATE C'
);

select is(
  (E'square\nsync_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in sales_imports error_message is rejected under COLLATE C'
);

select is(
  (E'square\u0000sync_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in sales_imports error_message is rejected under COLLATE C'
);

select is(
  (E'square\u007fsync_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in sales_imports error_message is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('square_sync_rate_limited' collate "C" !~ '[[:cntrl:]]')
    and (E'square\tsync_failed' collate "C" ~ '[[:cntrl:]]')
    and (E'square\nsync_failed' collate "C" ~ '[[:cntrl:]]')
    and (E'square\u007fsync_failed' collate "C" ~ '[[:cntrl:]]'),
  true,
  'sales_imports error_message control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'square\tsync_failed'),
      ('square_sync_rate_limited'),
      (E'square\nsync_failed'),
      (E'square\u007fsync_failed')
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
