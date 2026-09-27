-- MISE-005AX: supplier_deliveries client_delivery_id / idempotency_key
-- CHECKs must use COLLATE "C" so dump/restore cannot accept a delivery
-- identity the restored ASCII+ISO C-locale gate would refuse.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_client_delivery_id_check'
  ),
  'supplier_deliveries_client_delivery_id_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_idempotency_key_check'
  ),
  'supplier_deliveries_idempotency_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_client_delivery_id_check'
  ),
  'client_delivery_id collate "C" ~ ''\^\[A-Za-z0-9:_\+\.-\]\{1,200\}\$''',
  'supplier_deliveries client_delivery_id CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_idempotency_key_check'
  ),
  'idempotency_key collate "C" ~ ''\^\[A-Za-z0-9:_\+\.-\]\{1,240\}\$''',
  'supplier_deliveries idempotency_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%client_delivery_id%'
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_client_delivery_id_check'
  ),
  true,
  'supplier_deliveries client_delivery_id CHECK is not length-only'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%idempotency_key%'
    from pg_constraint
    where conrelid = 'public.supplier_deliveries'::regclass
      and conname = 'supplier_deliveries_idempotency_key_check'
  ),
  true,
  'supplier_deliveries idempotency_key CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and mint-focused.
select is(
  (
    'supplier_delivery:d0000000-0000-4000-8000-000000000201:2026-09-27T21:00:45.045Z'
      collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
  ),
  true,
  'writer client_delivery_id ISO Z mint matches under COLLATE C'
);

select is(
  (
    'supplier_delivery:d0000000-0000-4000-8000-000000000201:2026-09-27T21:00:45.045+00:00'
      collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
  ),
  true,
  'writer client_delivery_id ISO offset mint matches under COLLATE C'
);

select is(
  (
    'demo-delivery-pantry-1' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
  ),
  true,
  'demo client_delivery_id hyphenated mint matches under COLLATE C'
);

select is(
  (
    'operational-delivery-1' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
  ),
  true,
  'fixture client_delivery_id hyphenated mint matches under COLLATE C'
);

select is(
  (
    'supplier_delivery:supplier_delivery:d0000000-0000-4000-8000-000000000201:2026-09-27T21:00:45.045Z'
      collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  ),
  true,
  'writer idempotency_key embedding ISO client id matches under COLLATE C'
);

select is(
  (
    'supplier delivery spaced' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
  ),
  false,
  'spaced supplier_deliveries client_delivery_id is rejected under COLLATE C'
);

select is(
  (
    'supplier_delivery:café' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,200}$'
  ),
  false,
  'non-ASCII supplier_deliveries client_delivery_id is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'),
  false,
  'empty supplier_deliveries idempotency_key is rejected under COLLATE C'
);

select * from finish();
rollback;
