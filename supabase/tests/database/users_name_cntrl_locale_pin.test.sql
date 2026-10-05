-- MISE-005IL: public.users.name CHECK must keep the exact writer length
-- bound and pin ASCII control rejection under COLLATE "C" so dump/restore
-- cannot accept operator-name bytes the restored C-locale gate would
-- refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_name_check'
  ),
  'users_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_name_check'
  ),
  'length\(.*btrim\(name\)\) between 1 and 120',
  'users name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_name_check'
  ),
  'name collate "C" !~ ''[[:cntrl:]]''',
  'users name CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Alex Morgan' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable operator name is accepted under COLLATE C'
);

select is(
  (E'Alex\tMorgan' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in operator name is rejected under COLLATE C'
);

select is(
  (E'Alex\nMorgan' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in operator name is rejected under COLLATE C'
);

select is(
  (E'Alex\u007fMorgan' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in operator name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Alex Morgan' collate "C" !~ '[[:cntrl:]]')
    and (E'Alex\tMorgan' collate "C" ~ '[[:cntrl:]]')
    and (E'Alex\u007fMorgan' collate "C" ~ '[[:cntrl:]]'),
  true,
  'operator name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Alex\tMorgan'),
      ('Alex Morgan'),
      (E'Alex\nMorgan'),
      (E'Alex\u007fMorgan')
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
    where conrelid = 'public.users'::regclass
      and conname = 'users_name_check'
  ),
  'between 1 and 120',
  'users name CHECK keeps original length window'
);

select * from finish();
rollback;
