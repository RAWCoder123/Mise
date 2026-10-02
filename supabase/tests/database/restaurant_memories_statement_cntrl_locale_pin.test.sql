-- MISE-005EY: public.restaurant_memories.statement CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept statement bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_statement_check'
  ),
  'restaurant_memories_statement_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_statement_check'
  ),
  'length\(trim\(statement\)\) between 1 and 1000',
  'restaurant_memories statement CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_statement_check'
  ),
  'statement collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_memories statement CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Acme Produce matched all 3 logged deliveries.' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable restaurant memory statement is accepted under COLLATE C'
);

select is(
  (E'Acme Produce\tmatched all 3 logged deliveries.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant memory statement is rejected under COLLATE C'
);

select is(
  (E'Acme Produce\nmatched all 3 logged deliveries.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant memory statement is rejected under COLLATE C'
);

select is(
  (E'Acme Produce\u0000matched all 3 logged deliveries.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in restaurant memory statement is rejected under COLLATE C'
);

select is(
  (E'Acme Produce\u007fmatched all 3 logged deliveries.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant memory statement is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Acme Produce matched all 3 logged deliveries.' collate "C" !~ '[[:cntrl:]]')
    and (E'Acme Produce\tmatched all 3 logged deliveries.' collate "C" ~ '[[:cntrl:]]')
    and (E'Acme Produce\nmatched all 3 logged deliveries.' collate "C" ~ '[[:cntrl:]]')
    and (E'Acme Produce\u007fmatched all 3 logged deliveries.' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant memory statement control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Acme Produce\tmatched all 3 logged deliveries.'),
      ('Acme Produce matched all 3 logged deliveries.'),
      (E'Acme Produce\nmatched all 3 logged deliveries.'),
      (E'Acme Produce\u007fmatched all 3 logged deliveries.')
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
      and conname = 'restaurant_memories_statement_check'
  ),
  'between 1 and 1000',
  'restaurant_memories statement CHECK keeps original length window'
);

select * from finish();
rollback;
