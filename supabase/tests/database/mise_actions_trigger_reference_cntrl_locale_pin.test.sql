-- MISE-005FL: public.mise_actions.trigger_reference CHECK must keep
-- its null-or-length(trim) 1..240 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept trigger_reference bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_trigger_reference_check'
  ),
  'mise_actions_trigger_reference_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_trigger_reference_check'
  ),
  'length\(trim\(trigger_reference\)\) between 1 and 240',
  'mise_actions trigger_reference CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_trigger_reference_check'
  ),
  'trigger_reference collate "C" !~ ''[[:cntrl:]]''',
  'mise_actions trigger_reference CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('a0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable mise_actions trigger_reference is accepted under COLLATE C'
);

select is(
  (E'supplier\torder:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in mise_actions trigger_reference is rejected under COLLATE C'
);

select is(
  (E'supplier\norder:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in mise_actions trigger_reference is rejected under COLLATE C'
);

select is(
  (E'supplier\u0000order:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in mise_actions trigger_reference is rejected under COLLATE C'
);

select is(
  (E'supplier\u007forder:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in mise_actions trigger_reference is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('a0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]')
    and (E'supplier\torder:item-1' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier\norder:item-1' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier\u007forder:item-1' collate "C" ~ '[[:cntrl:]]'),
  true,
  'mise_actions trigger_reference control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'supplier\torder:item-1'),
      ('a0000000-0000-4000-8000-000000000001'),
      (E'supplier\norder:item-1'),
      (E'supplier\u007forder:item-1')
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
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_trigger_reference_check'
  ),
  'between 1 and 240',
  'mise_actions trigger_reference CHECK keeps original length window'
);

select * from finish();
rollback;
