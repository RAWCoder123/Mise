-- MISE-005AZ: private.square_credentials.merchant_id CHECK must use
-- COLLATE "C" so dump/restore cannot accept a merchant identity the
-- restored ASCII C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.square_credentials'::regclass
      and conname = 'square_credentials_merchant_id_check'
  ),
  'square_credentials_merchant_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.square_credentials'::regclass
      and conname = 'square_credentials_merchant_id_check'
  ),
  'merchant_id collate "C" ~ ''\^\[A-Za-z0-9_-\]\{1,128\}\$''',
  'square_credentials merchant_id CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length(merchant_id)%'
    from pg_constraint
    where conrelid = 'private.square_credentials'::regclass
      and conname = 'square_credentials_merchant_id_check'
  ),
  true,
  'square_credentials merchant_id CHECK is not length-only'
);

select matches(
  pg_get_functiondef('private.service_complete_square_oauth(uuid, text, text, text, text[], jsonb)'::regprocedure),
  'p_merchant_id collate "C" !~ ''\^\[A-Za-z0-9_-\]\{1,128\}\$''',
  'complete_square_oauth merchant_id gate uses COLLATE C'
);

select is(
  (
    pg_get_functiondef(
      'private.service_complete_square_oauth(uuid, text, text, text, text[], jsonb)'::regprocedure
    ) not ilike '%length(p_merchant_id)%'
  ),
  true,
  'complete_square_oauth merchant_id gate is not length-only'
);

select matches(
  pg_get_functiondef('private.service_resolve_square_webhook_merchant(text)'::regprocedure),
  'p_merchant_id collate "C" !~ ''\^\[A-Za-z0-9_-\]\{1,128\}\$''',
  'resolve_square_webhook_merchant gate uses COLLATE C'
);

select is(
  (
    pg_get_functiondef(
      'private.service_resolve_square_webhook_merchant(text)'::regprocedure
    ) not ilike '%length(p_merchant_id)%'
  ),
  true,
  'resolve_square_webhook_merchant gate is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and mint-focused.
select is(
  ('MLG2Y3WQ3C3SN' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  true,
  'Square-shaped merchant_id matches under COLLATE C'
);

select is(
  ('sandbox_merchant-1' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  true,
  'underscore/hyphen merchant_id matches under COLLATE C'
);

select is(
  ('merchant id spaced' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  false,
  'spaced merchant_id is rejected under COLLATE C'
);

select is(
  ('merchant_café' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  false,
  'non-ASCII merchant_id is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  false,
  'empty merchant_id is rejected under COLLATE C'
);

select * from finish();
rollback;
