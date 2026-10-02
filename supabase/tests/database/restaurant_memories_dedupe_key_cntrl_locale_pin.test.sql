-- MISE-005FF: public.restaurant_memories.dedupe_key CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept dedupe_key bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_dedupe_key_check'
  ),
  'restaurant_memories_dedupe_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_dedupe_key_check'
  ),
  'length\(trim\(dedupe_key\)\) between 1 and 240',
  'restaurant_memories dedupe_key CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_dedupe_key_check'
  ),
  'dedupe_key collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_memories dedupe_key CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('supplier-delivery-outcome:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable durable restaurant memory dedupe_key is accepted under COLLATE C'
);

select is(
  (E'supplier-delivery-outcome:\tsysco' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant memory dedupe_key is rejected under COLLATE C'
);

select is(
  (E'supplier-delivery-outcome:\nsysco' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant memory dedupe_key is rejected under COLLATE C'
);

select is(
  (E'supplier-delivery-outcome:\u0000sysco' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in restaurant memory dedupe_key is rejected under COLLATE C'
);

select is(
  (E'supplier-delivery-outcome:\u007fsysco' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant memory dedupe_key is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('supplier-delivery-outcome:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' collate "C" !~ '[[:cntrl:]]')
    and (E'supplier-delivery-outcome:\tsysco' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier-delivery-outcome:\nsysco' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier-delivery-outcome:\u007fsysco' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant memory dedupe_key control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'supplier-delivery-outcome:\tsysco'),
      ('supplier-delivery-outcome:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
      (E'supplier-delivery-outcome:\nsysco'),
      (E'supplier-delivery-outcome:\u007fsysco'),
      ('supplier-delivery-outcome:sysco foods'),
      ('legacy-supplier-delivery-outcome:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
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
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_dedupe_key_check'
  ),
  'between 1 and 240',
  'restaurant_memories dedupe_key CHECK keeps original length window'
);

select * from finish();
rollback;
