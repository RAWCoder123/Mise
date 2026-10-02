-- MISE-005FE: public.activity_events.idempotency_key CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept idempotency_key bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_idempotency_key_check'
  ),
  'activity_events_idempotency_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_idempotency_key_check'
  ),
  'length\(trim\(idempotency_key\)\) between 1 and 240',
  'activity_events idempotency_key CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_idempotency_key_check'
  ),
  'idempotency_key collate "C" !~ ''[[:cntrl:]]''',
  'activity_events idempotency_key CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('restaurant_task:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:created' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable activity idempotency_key is accepted under COLLATE C'
);

select is(
  (E'restaurant_task:\tidem' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in activity idempotency_key is rejected under COLLATE C'
);

select is(
  (E'restaurant_task:\nidem' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in activity idempotency_key is rejected under COLLATE C'
);

select is(
  (E'restaurant_task:\u0000idem' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in activity idempotency_key is rejected under COLLATE C'
);

select is(
  (E'restaurant_task:\u007fidem' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in activity idempotency_key is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('restaurant_task:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:created' collate "C" !~ '[[:cntrl:]]')
    and (E'restaurant_task:\tidem' collate "C" ~ '[[:cntrl:]]')
    and (E'restaurant_task:\nidem' collate "C" ~ '[[:cntrl:]]')
    and (E'restaurant_task:\u007fidem' collate "C" ~ '[[:cntrl:]]'),
  true,
  'activity idempotency_key control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'restaurant_task:\tidem'),
      ('restaurant_task:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:created'),
      (E'restaurant_task:\nidem'),
      (E'restaurant_task:\u007fidem'),
      ('inventory_count:item-1:2026-10-02T08:01:38.662Z'),
      ('memory_updated:rest-1:2026-10-02T08:Mise memory is reliable')
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
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_idempotency_key_check'
  ),
  'between 1 and 240',
  'activity_events idempotency_key CHECK keeps original length window'
);

select * from finish();
rollback;
