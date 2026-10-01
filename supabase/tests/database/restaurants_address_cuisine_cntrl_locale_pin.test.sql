-- MISE-005EK: public.restaurants.address and cuisine_type CHECKs must keep
-- their exact length bounds and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept profile bytes the restored
-- C-locale gate would refuse.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_address_length_check'
  ),
  'restaurants_address_length_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_address_length_check'
  ),
  'length\(address\) <= 500',
  'restaurants address CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_address_length_check'
  ),
  'address collate "C" !~ ''[[:cntrl:]]''',
  'restaurants address CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_cuisine_type_length_check'
  ),
  'restaurants_cuisine_type_length_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_cuisine_type_length_check'
  ),
  'length\(cuisine_type\) <= 120',
  'restaurants cuisine_type CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_cuisine_type_length_check'
  ),
  'cuisine_type collate "C" !~ ''[[:cntrl:]]''',
  'restaurants cuisine_type CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('12 Harbor St' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable restaurant profile text is accepted under COLLATE C'
);

select is(
  (E'12 Harbor\tSt' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant profile text is rejected under COLLATE C'
);

select is(
  (E'12 Harbor\nSt' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant profile text is rejected under COLLATE C'
);

select is(
  (E'12 Harbor\u007fSt' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant profile text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('12 Harbor St' collate "C" !~ '[[:cntrl:]]')
    and (E'12 Harbor\tSt' collate "C" ~ '[[:cntrl:]]')
    and (E'12 Harbor\u007fSt' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant profile control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'12 Harbor\tSt'),
      ('12 Harbor St'),
      (E'12 Harbor\nSt'),
      (E'12 Harbor\u007fSt')
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
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_address_length_check'
  ),
  '<= 500',
  'restaurants address CHECK keeps original length window'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_cuisine_type_length_check'
  ),
  '<= 120',
  'restaurants cuisine_type CHECK keeps original length window'
);

select * from finish();
rollback;
