-- MISE-005GK: public.pos_locations.display_name CHECK must keep its
-- exact length(trim) 1..200 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept display_name bytes the restored
-- C-locale gate would refuse. Column is NOT NULL. Sibling status CHECK
-- stays on its separate constraint.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_locations'::regclass
      and conname = 'pos_locations_display_name_check'
  ),
  'pos_locations_display_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_locations'::regclass
      and conname = 'pos_locations_display_name_check'
  ),
  'length\(trim\(display_name\)\) between 1 and 200',
  'pos_locations display_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_locations'::regclass
      and conname = 'pos_locations_display_name_check'
  ),
  'display_name collate "C" !~ ''[[:cntrl:]]''',
  'pos_locations display_name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_locations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%active%'
  ),
  'pos_locations status CHECK remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_locations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%active%'
    limit 1
  ) ilike '%[[:cntrl:]]%',
  false,
  'pos_locations status CHECK still excludes display_name cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Downtown Counter' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable POS location display name is accepted under COLLATE C'
);

select is(
  (E'Downtown\tCounter' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in POS location display name is rejected under COLLATE C'
);

select is(
  (E'Downtown\nCounter' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in POS location display name is rejected under COLLATE C'
);

select is(
  (E'Downtown\u007fCounter' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in POS location display name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Downtown Counter' collate "C" !~ '[[:cntrl:]]')
    and (E'Downtown\tCounter' collate "C" ~ '[[:cntrl:]]')
    and (E'Downtown\nCounter' collate "C" ~ '[[:cntrl:]]')
    and (E'Downtown\u007fCounter' collate "C" ~ '[[:cntrl:]]'),
  true,
  'POS location display name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Downtown\tCounter'),
      ('Downtown Counter'),
      (E'Downtown\nCounter'),
      (E'Downtown\u007fCounter')
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
    where conrelid = 'public.pos_locations'::regclass
      and contype = 'c'
      and conname = 'pos_locations_display_name_check'
  ),
  1::bigint,
  'exactly one pos_locations_display_name_check constraint is attached'
);

select * from finish();
rollback;
