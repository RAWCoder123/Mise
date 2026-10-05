-- MISE-005II: private.square_oauth_flows.failure_code CHECK must keep
-- its null-or-length 1..80 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept failure_code bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_failure_code_check'
  ),
  'square_oauth_flows_failure_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_failure_code_check'
  ),
  'length\(failure_code\) between 1 and 80',
  'square_oauth_flows failure_code CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_failure_code_check'
  ),
  'failure_code collate "C" !~ ''[[:cntrl:]]''',
  'square_oauth_flows failure_code CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('superseded' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable oauth failure_code is accepted under COLLATE C'
);

select is(
  (E'super\tseded' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in oauth failure_code is rejected under COLLATE C'
);

select is(
  (E'super\nseded' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in oauth failure_code is rejected under COLLATE C'
);

select is(
  (E'super\u0000seded' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in oauth failure_code is rejected under COLLATE C'
);

select is(
  (E'super\u007fseded' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in oauth failure_code is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('superseded' collate "C" !~ '[[:cntrl:]]')
    and (E'super\tseded' collate "C" ~ '[[:cntrl:]]')
    and (E'super\nseded' collate "C" ~ '[[:cntrl:]]')
    and (E'super\u007fseded' collate "C" ~ '[[:cntrl:]]'),
  true,
  'oauth failure_code control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'super\tseded'),
      ('superseded'),
      (E'super\nseded'),
      (E'super\u007fseded')
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
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_failure_code_check'
  ),
  'between 1 and 80',
  'square_oauth_flows failure_code CHECK keeps original length window'
);

select * from finish();
rollback;
