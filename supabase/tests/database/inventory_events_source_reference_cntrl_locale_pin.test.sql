-- MISE-005HG: public.inventory_events.source_reference CHECK must keep
-- its null-or-length(trim) 1..200 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept source_reference bytes the
-- restored C-locale gate would refuse. Sibling source / identity / event_type
-- CHECKs stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_source_reference_check'
  ),
  'inventory_events_source_reference_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_source_reference_check'
  ),
  'length\(trim\(source_reference\)\) between 1 and 200',
  'inventory_events source_reference CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_source_reference_check'
  ),
  'source_reference collate "C" !~ ''[[:cntrl:]]''',
  'inventory_events source_reference CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and contype = 'c'
      and (
        conname = 'inventory_events_source_check'
        or (
          pg_get_constraintdef(oid) ~* '\ysource\y'
          and pg_get_constraintdef(oid) not ilike '%source_reference%'
        )
      )
  ),
  'inventory_events source CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and contype = 'c'
      and conname = 'inventory_events_source_reference_check'
    limit 1
  ) ilike '%client_event_id%',
  false,
  'source_reference CHECK stays dedicated (excludes client_event_id)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('delivery-1' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory event source_reference is accepted under COLLATE C'
);

select is(
  (E'delivery\t1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory event source_reference is rejected under COLLATE C'
);

select is(
  (E'delivery\n1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory event source_reference is rejected under COLLATE C'
);

select is(
  (E'delivery\u007f1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory event source_reference is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('delivery-1' collate "C" !~ '[[:cntrl:]]')
    and (E'delivery\t1' collate "C" ~ '[[:cntrl:]]')
    and (E'delivery\n1' collate "C" ~ '[[:cntrl:]]')
    and (E'delivery\u007f1' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory event source_reference control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'delivery\t1'),
      ('delivery-1'),
      (E'delivery\n1'),
      (E'delivery\u007f1')
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
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_source_reference_check'
  ),
  'between 1 and 200',
  'inventory_events source_reference CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and contype = 'c'
      and conname = 'inventory_events_source_reference_check'
  ),
  1::bigint,
  'exactly one source_reference_check constraint is attached'
);

select * from finish();
rollback;
