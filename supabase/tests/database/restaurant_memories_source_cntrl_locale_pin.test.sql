-- MISE-005FB: public.restaurant_memories.source CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept source bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_source_check'
  ),
  'restaurant_memories_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_source_check'
  ),
  'length\(trim\(source\)\) between 1 and 120',
  'restaurant_memories source CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_source_check'
  ),
  'source collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_memories source CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('supplier_delivery_outcomes' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable restaurant memory source is accepted under COLLATE C'
);

select is(
  (E'supplier_delivery\toutcomes' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant memory source is rejected under COLLATE C'
);

select is(
  (E'supplier_delivery\noutcomes' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant memory source is rejected under COLLATE C'
);

select is(
  (E'supplier_delivery\u0000outcomes' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in restaurant memory source is rejected under COLLATE C'
);

select is(
  (E'supplier_delivery\u007foutcomes' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant memory source is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('supplier_delivery_outcomes' collate "C" !~ '[[:cntrl:]]')
    and (E'supplier_delivery\toutcomes' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier_delivery\noutcomes' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier_delivery\u007foutcomes' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant memory source control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'supplier_delivery\toutcomes'),
      ('supplier_delivery_outcomes'),
      (E'supplier_delivery\noutcomes'),
      (E'supplier_delivery\u007foutcomes')
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
      and conname = 'restaurant_memories_source_check'
  ),
  'between 1 and 120',
  'restaurant_memories source CHECK keeps original length window'
);

select * from finish();
rollback;
