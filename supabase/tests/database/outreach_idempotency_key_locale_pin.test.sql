-- MISE-005BK: outreach_messages.idempotency_key CHECK must use COLLATE "C"
-- so dump/restore cannot accept an identity the restored ASCII C-locale gate
-- would refuse (and vice versa). Default mint is outreach_ + 32 hex digits.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_idempotency_key_check'
  ),
  'outreach_messages_idempotency_key_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_idempotency_key_check'
  ),
  'idempotency_key collate "C" ~ ''\^\[A-Za-z0-9_\]\{1,64\}\$''',
  'outreach_messages idempotency_key CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%idempotency_key%'
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_idempotency_key_check'
  ),
  true,
  'outreach_messages idempotency_key CHECK is not length-only'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%provider_message_id%'
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_idempotency_key_check'
  ),
  true,
  'outreach_messages idempotency_key CHECK does not touch provider_message_id'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (
    'outreach_a1b2c3d4e5f60718293a4b5c6d7e8f90' collate "C"
      ~ '^[A-Za-z0-9_]{1,64}$'
  ),
  true,
  'default outreach_ + hex uuid mint matches under COLLATE C'
);

select is(
  (
    ('outreach_' || replace('a1b2c3d4-e5f6-0718-293a-4b5c6d7e8f90'::text, '-', ''))
      collate "C" ~ '^[A-Za-z0-9_]{1,64}$'
  ),
  true,
  'foundation default expression mint matches under COLLATE C'
);

select is(
  ('outreach_ABCDEF0123456789abcdef0123456789' collate "C" ~ '^[A-Za-z0-9_]{1,64}$'),
  true,
  'uppercase hex outreach mint matches under COLLATE C'
);

select is(
  ('outreach_short' collate "C" ~ '^[A-Za-z0-9_]{1,64}$'),
  true,
  'short ASCII underscore mint matches under COLLATE C'
);

select is(
  ('outreach key spaced' collate "C" ~ '^[A-Za-z0-9_]{1,64}$'),
  false,
  'spaced outreach idempotency_key is rejected under COLLATE C'
);

select is(
  ('outreach-with-hyphen' collate "C" ~ '^[A-Za-z0-9_]{1,64}$'),
  false,
  'hyphenated outreach idempotency_key is rejected under COLLATE C'
);

select is(
  (E'outreach_\tctrl' collate "C" ~ '^[A-Za-z0-9_]{1,64}$'),
  false,
  'control-bearing outreach idempotency_key is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9_]{1,64}$'),
  false,
  'empty outreach idempotency_key is rejected under COLLATE C'
);

select * from finish();
rollback;
