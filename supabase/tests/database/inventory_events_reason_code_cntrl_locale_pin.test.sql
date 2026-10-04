-- MISE-005HH: public.inventory_events.reason_code CHECK must keep
-- its null-or-length(trim) 1..80 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept reason_code bytes the
-- restored C-locale gate would refuse. Sibling source / source_reference /
-- identity / event_type CHECKs stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_reason_code_check'
  ),
  'inventory_events_reason_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_reason_code_check'
  ),
  'length\(trim\(reason_code\)\) between 1 and 80',
  'inventory_events reason_code CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_reason_code_check'
  ),
  'reason_code collate "C" !~ ''[[:cntrl:]]''',
  'inventory_events reason_code CHECK uses COLLATE C cntrl rejection'
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
          and pg_get_constraintdef(oid) not ilike '%reason_code%'
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
      and conname = 'inventory_events_reason_code_check'
    limit 1
  ) ilike '%client_event_id%',
  false,
  'reason_code CHECK stays dedicated (excludes client_event_id)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('cycle_count' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory event reason_code is accepted under COLLATE C'
);

select is(
  (E'cycle\tcount' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory event reason_code is rejected under COLLATE C'
);

select is(
  (E'cycle\ncount' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory event reason_code is rejected under COLLATE C'
);

select is(
  (E'cycle\u007fcount' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory event reason_code is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('cycle_count' collate "C" !~ '[[:cntrl:]]')
    and (E'cycle\tcount' collate "C" ~ '[[:cntrl:]]')
    and (E'cycle\ncount' collate "C" ~ '[[:cntrl:]]')
    and (E'cycle\u007fcount' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory event reason_code control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'cycle\tcount'),
      ('cycle_count'),
      (E'cycle\ncount'),
      (E'cycle\u007fcount')
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
      and conname = 'inventory_events_reason_code_check'
  ),
  'between 1 and 80',
  'inventory_events reason_code CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and contype = 'c'
      and conname = 'inventory_events_reason_code_check'
  ),
  1::bigint,
  'exactly one reason_code_check constraint is attached'
);

select * from finish();
rollback;
