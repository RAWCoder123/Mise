-- MISE-005GQ: public.restaurant_memories.rule_reference CHECK must keep
-- its null-or-length(trim) 1..240 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept rule_reference bytes the restored
-- C-locale gate would refuse. Sibling source / statement / correction /
-- dedupe_key CHECKs stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_rule_reference_check'
  ),
  'restaurant_memories_rule_reference_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_rule_reference_check'
  ),
  'length\(trim\(rule_reference\)\) between 1 and 240',
  'restaurant_memories rule_reference CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and conname = 'restaurant_memories_rule_reference_check'
  ),
  'rule_reference collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_memories rule_reference CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and contype = 'c'
      and (
        conname = 'restaurant_memories_dedupe_key_check'
        or pg_get_constraintdef(oid) ilike '%dedupe_key%'
      )
  ),
  'restaurant_memories dedupe_key CHECK remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memories'::regclass
      and contype = 'c'
      and conname = 'restaurant_memories_rule_reference_check'
    limit 1
  ) ilike '%dedupe_key%',
  false,
  'rule_reference CHECK stays dedicated (excludes dedupe_key)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('autonomy-rule:a0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable restaurant memory rule_reference is accepted under COLLATE C'
);

select is(
  (E'autonomy-rule:\ta0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant memory rule_reference is rejected under COLLATE C'
);

select is(
  (E'autonomy-rule:\na0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant memory rule_reference is rejected under COLLATE C'
);

select is(
  (E'autonomy-rule:\u0000a0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in restaurant memory rule_reference is rejected under COLLATE C'
);

select is(
  (E'autonomy-rule:\u007fa0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant memory rule_reference is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('autonomy-rule:a0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]')
    and (E'autonomy-rule:\ta0000000-0000-4000-8000-000000000001' collate "C" ~ '[[:cntrl:]]')
    and (E'autonomy-rule:\na0000000-0000-4000-8000-000000000001' collate "C" ~ '[[:cntrl:]]')
    and (E'autonomy-rule:\u007fa0000000-0000-4000-8000-000000000001' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant memory rule_reference control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'autonomy-rule:\ta0000000-0000-4000-8000-000000000001'),
      ('autonomy-rule:a0000000-0000-4000-8000-000000000001'),
      (E'autonomy-rule:\na0000000-0000-4000-8000-000000000001'),
      (E'autonomy-rule:\u007fa0000000-0000-4000-8000-000000000001')
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
      and conname = 'restaurant_memories_rule_reference_check'
  ),
  'between 1 and 240',
  'restaurant_memories rule_reference CHECK keeps original length window'
);

select * from finish();
rollback;
