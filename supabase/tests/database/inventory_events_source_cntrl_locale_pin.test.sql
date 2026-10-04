-- MISE-005HF: public.inventory_events.source CHECK must keep its
-- exact length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept source bytes the restored C-locale gate would
-- refuse. Sibling identity / event_type / source_reference CHECKs stay on
-- separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_source_check'
  ),
  'inventory_events_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_source_check'
  ),
  'length\(trim\(source\)\) between 1 and 80',
  'inventory_events source CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_source_check'
  ),
  'source collate "C" !~ ''[[:cntrl:]]''',
  'inventory_events source CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and contype = 'c'
      and (
        conname in (
          'inventory_events_client_event_id_check',
          'inventory_events_idempotency_key_check'
        )
        or pg_get_constraintdef(oid) ilike '%client_event_id%'
        or pg_get_constraintdef(oid) ilike '%idempotency_key%'
      )
  ),
  'inventory_events client_event_id or identity CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and contype = 'c'
      and conname = 'inventory_events_source_check'
    limit 1
  ) ilike '%client_event_id%',
  false,
  'source CHECK stays dedicated (excludes client_event_id)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('manual' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory event source is accepted under COLLATE C'
);

select is(
  (E'manual\tpos' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory event source is rejected under COLLATE C'
);

select is(
  (E'manual\npos' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory event source is rejected under COLLATE C'
);

select is(
  (E'manual\u007fpos' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory event source is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('manual' collate "C" !~ '[[:cntrl:]]')
    and (E'manual\tpos' collate "C" ~ '[[:cntrl:]]')
    and (E'manual\npos' collate "C" ~ '[[:cntrl:]]')
    and (E'manual\u007fpos' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory event source control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'manual\tpos'),
      ('manual'),
      (E'manual\npos'),
      (E'manual\u007fpos')
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
      and conname = 'inventory_events_source_check'
  ),
  'between 1 and 80',
  'inventory_events source CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and contype = 'c'
      and conname = 'inventory_events_source_check'
  ),
  1::bigint,
  'exactly one source_check constraint is attached'
);

select * from finish();
rollback;
