-- MISE-005AW: mise_actions / action_outcomes idempotency_key CHECKs must
-- use COLLATE "C" so dump/restore cannot accept an identity the restored
-- ASCII C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_idempotency_key_check'
  ),
  'mise_actions_idempotency_key_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_idempotency_key_check'
  ),
  'action_outcomes_idempotency_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_idempotency_key_check'
  ),
  'idempotency_key collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,240\}\$''',
  'mise_actions idempotency_key CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_idempotency_key_check'
  ),
  'idempotency_key collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,240\}\$''',
  'action_outcomes idempotency_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%idempotency_key%'
    from pg_constraint
    where conrelid = 'public.mise_actions'::regclass
      and conname = 'mise_actions_idempotency_key_check'
  ),
  true,
  'mise_actions idempotency_key CHECK is not length-only'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%idempotency_key%'
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_idempotency_key_check'
  ),
  true,
  'action_outcomes idempotency_key CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (
    'send_supplier_order:d0000000-0000-4000-8000-000000000201' collate "C"
      ~ '^[A-Za-z0-9:_-]{1,240}$'
  ),
  true,
  'writer mise_actions send_supplier_order UUID mint matches under COLLATE C'
);

select is(
  (
    'supplier_delivery_outcome:d0000000-0000-4000-8000-000000000301' collate "C"
      ~ '^[A-Za-z0-9:_-]{1,240}$'
  ),
  true,
  'writer action_outcomes supplier_delivery_outcome UUID mint matches under COLLATE C'
);

select is(
  (
    'd0000000-0000-4000-8000-000000000001:send_supplier_order:order_1' collate "C"
      ~ '^[A-Za-z0-9:_-]{1,240}$'
  ),
  true,
  'demo mise_actions restaurantId:actionType:subject mint matches under COLLATE C'
);

select is(
  ('read-only-fixture' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  true,
  'fixture mise_actions hyphenated mint matches under COLLATE C'
);

select is(
  ('send supplier order spaced' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  false,
  'spaced mise_actions idempotency_key is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'),
  false,
  'empty action_outcomes idempotency_key is rejected under COLLATE C'
);

select * from finish();
rollback;
