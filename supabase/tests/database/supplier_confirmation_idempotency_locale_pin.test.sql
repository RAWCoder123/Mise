-- MISE-005AY: supplier_order_confirmations.idempotency_key CHECK must use
-- COLLATE "C" so dump/restore cannot accept a confirmation identity the
-- restored ASCII+ISO C-locale gate would refuse.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_idempotency_key_check'
  ),
  'supplier_order_confirmations_idempotency_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_idempotency_key_check'
  ),
  'idempotency_key collate "C" ~ ''\^\[A-Za-z0-9:_\+\.-\]\{1,240\}\$''',
  'supplier_order_confirmations idempotency_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%idempotency_key%'
    from pg_constraint
    where conrelid = 'public.supplier_order_confirmations'::regclass
      and conname = 'supplier_order_confirmations_idempotency_key_check'
  ),
  true,
  'supplier_order_confirmations idempotency_key CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and mint-focused.
select is(
  (
    'manager_confirmation:mgr-confirm:d0000000-0000-4000-8000-000000000201:2026-09-27T22:00:45.045Z'
      collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  ),
  true,
  'writer idempotency_key ISO Z mint matches under COLLATE C'
);

select is(
  (
    'manager_confirmation:mgr-confirm:d0000000-0000-4000-8000-000000000201:2026-09-27T22:00:45.045+00:00'
      collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  ),
  true,
  'writer idempotency_key ISO offset mint matches under COLLATE C'
);

select is(
  (
    'supplier-confirmation-1' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  ),
  true,
  'fixture supplier-confirmation-1 matches under COLLATE C'
);

select is(
  (
    'mgr-confirm:d0000000-0000-4000-8000-000000000201:2026-09-27T22:00:45.045Z'
      collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  ),
  true,
  'client confirmation id ISO Z mint matches under COLLATE C'
);

select is(
  (
    'manager confirmation spaced' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  ),
  false,
  'spaced supplier_order_confirmations idempotency_key is rejected under COLLATE C'
);

select is(
  (
    'manager_confirmation:café' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'
  ),
  false,
  'non-ASCII supplier_order_confirmations idempotency_key is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9:_+.-]{1,240}$'),
  false,
  'empty supplier_order_confirmations idempotency_key is rejected under COLLATE C'
);

select * from finish();
rollback;
