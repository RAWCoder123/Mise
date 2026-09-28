-- MISE-005BR: inventory_events client_event_id and idempotency_key CHECKs
-- must use COLLATE "C" so dump/restore cannot accept a ledger identity the
-- restored ASCII C-locale gate would refuse.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_client_event_id_check'
  ),
  'inventory_events_client_event_id_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_idempotency_key_check'
  ),
  'inventory_events_idempotency_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_client_event_id_check'
  ),
  'client_event_id collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,200\}\$''',
  'inventory_events client_event_id CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_idempotency_key_check'
  ),
  'idempotency_key collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,240\}\$''',
  'inventory_events idempotency_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%client_event_id%'
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_client_event_id_check'
  ),
  true,
  'inventory_events client_event_id CHECK is not length-only'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%idempotency_key%'
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_idempotency_key_check'
  ),
  true,
  'inventory_events idempotency_key CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (
    'inventory_event_01234567-89ab-cdef-0123-456789abcdef' collate "C"
      ~ '^[A-Za-z0-9:_-]{1,200}$'
  ),
  true,
  'writer client_event_id createId mint matches under COLLATE C'
);

select is(
  (
    'inventory:inventory_event_01234567-89ab-cdef-0123-456789abcdef'
      collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  ),
  true,
  'writer idempotency_key inventory prefix matches under COLLATE C'
);

select is(
  ('device event 1' collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'),
  false,
  'spaced inventory-event client_event_id is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  false,
  'empty inventory-event idempotency_key is rejected under COLLATE C'
);

select * from finish();
rollback;
