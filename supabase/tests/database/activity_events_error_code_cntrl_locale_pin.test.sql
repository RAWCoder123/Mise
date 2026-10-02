-- MISE-005FK: public.activity_events.error_code CHECK must keep
-- its null-or-length(trim) 1..80 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept error_code bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_error_code_check'
  ),
  'activity_events_error_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_error_code_check'
  ),
  'length\(trim\(error_code\)\) between 1 and 80',
  'activity_events error_code CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_error_code_check'
  ),
  'error_code collate "C" !~ ''[[:cntrl:]]''',
  'activity_events error_code CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('square_webhook_refresh_failed' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable activity error_code is accepted under COLLATE C'
);

select is(
  (E'square\twebhook_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in activity error_code is rejected under COLLATE C'
);

select is(
  (E'square\nwebhook_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in activity error_code is rejected under COLLATE C'
);

select is(
  (E'square\u0000webhook_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in activity error_code is rejected under COLLATE C'
);

select is(
  (E'square\u007fwebhook_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in activity error_code is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('square_webhook_refresh_failed' collate "C" !~ '[[:cntrl:]]')
    and (E'square\twebhook_failed' collate "C" ~ '[[:cntrl:]]')
    and (E'square\nwebhook_failed' collate "C" ~ '[[:cntrl:]]')
    and (E'square\u007fwebhook_failed' collate "C" ~ '[[:cntrl:]]'),
  true,
  'activity error_code control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'square\twebhook_failed'),
      ('square_webhook_refresh_failed'),
      (E'square\nwebhook_failed'),
      (E'square\u007fwebhook_failed')
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
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_error_code_check'
  ),
  'between 1 and 80',
  'activity_events error_code CHECK keeps original length window'
);

select * from finish();
rollback;
