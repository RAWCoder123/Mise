-- MISE-005EJ: public.restaurants.name CHECK must keep the exact length
-- bound and pin ASCII control rejection under COLLATE "C" so dump/restore
-- cannot accept restaurant-name bytes the restored C-locale gate would
-- refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_name_length_check'
  ),
  'restaurants_name_length_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_name_length_check'
  ),
  'length\(.*btrim\(name\)\) between 1 and 120',
  'restaurants name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_name_length_check'
  ),
  'name collate "C" !~ ''[[:cntrl:]]''',
  'restaurants name CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Harbor Kitchen' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable restaurant name is accepted under COLLATE C'
);

select is(
  (E'Harbor\tKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant name is rejected under COLLATE C'
);

select is(
  (E'Harbor\nKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant name is rejected under COLLATE C'
);

select is(
  (E'Harbor\u007fKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Harbor Kitchen' collate "C" !~ '[[:cntrl:]]')
    and (E'Harbor\tKitchen' collate "C" ~ '[[:cntrl:]]')
    and (E'Harbor\u007fKitchen' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Harbor\tKitchen'),
      ('Harbor Kitchen'),
      (E'Harbor\nKitchen'),
      (E'Harbor\u007fKitchen')
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
      and conname = 'restaurants_name_length_check'
  ),
  'between 1 and 120',
  'restaurants name CHECK keeps original length window'
);

select * from finish();
rollback;
