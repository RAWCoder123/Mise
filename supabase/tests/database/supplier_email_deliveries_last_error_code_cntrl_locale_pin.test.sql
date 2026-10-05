-- MISE-005IG: private.supplier_email_deliveries.last_error_code CHECK must keep
-- its null-or-length 1..80 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept last_error_code bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_last_error_code_check'
  ),
  'supplier_email_deliveries_last_error_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_last_error_code_check'
  ),
  'length\(last_error_code\) between 1 and 80',
  'supplier_email_deliveries last_error_code CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_last_error_code_check'
  ),
  'last_error_code collate "C" !~ ''[[:cntrl:]]''',
  'supplier_email_deliveries last_error_code CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('stale_send_claim' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable delivery last_error_code is accepted under COLLATE C'
);

select is(
  (E'stale\tsend_claim' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in delivery last_error_code is rejected under COLLATE C'
);

select is(
  (E'stale\nsend_claim' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in delivery last_error_code is rejected under COLLATE C'
);

select is(
  (E'stale\u0000send_claim' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in delivery last_error_code is rejected under COLLATE C'
);

select is(
  (E'stale\u007fsend_claim' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in delivery last_error_code is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('stale_send_claim' collate "C" !~ '[[:cntrl:]]')
    and (E'stale\tsend_claim' collate "C" ~ '[[:cntrl:]]')
    and (E'stale\nsend_claim' collate "C" ~ '[[:cntrl:]]')
    and (E'stale\u007fsend_claim' collate "C" ~ '[[:cntrl:]]'),
  true,
  'delivery last_error_code control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'stale\tsend_claim'),
      ('stale_send_claim'),
      (E'stale\nsend_claim'),
      (E'stale\u007fsend_claim')
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
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_last_error_code_check'
  ),
  'between 1 and 80',
  'supplier_email_deliveries last_error_code CHECK keeps original length window'
);

select * from finish();
rollback;
