-- MISE-005AP: provider OAuth failure_code and delivery last_error_code
-- CHECKs must use COLLATE "C" so dump/restore cannot accept a token
-- private.gmail_safe_error_code (MISE-005AE) would refuse under C locale.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.gmail_oauth_flows'::regclass
      and conname = 'gmail_oauth_flows_failure_code_check'
  ),
  'gmail_oauth_flows_failure_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_oauth_flows'::regclass
      and conname = 'gmail_oauth_flows_failure_code_check'
  ),
  'failure_code collate "C" ~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'gmail_oauth_flows.failure_code CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_oauth_flows'::regclass
      and conname = 'gmail_oauth_flows_failure_code_check'
  ),
  'failure_code is null',
  'gmail_oauth_flows.failure_code CHECK allows null success rows'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_failure_code_check'
  ),
  'square_oauth_flows_failure_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_failure_code_check'
  ),
  'failure_code collate "C" ~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'square_oauth_flows.failure_code CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_failure_code_check'
  ),
  'failure_code is null',
  'square_oauth_flows.failure_code CHECK allows null success rows'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_last_error_code_check'
  ),
  'supplier_email_deliveries_last_error_code_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_last_error_code_check'
  ),
  'last_error_code collate "C" ~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'supplier_email_deliveries.last_error_code CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_last_error_code_check'
  ),
  'last_error_code is null',
  'supplier_email_deliveries.last_error_code CHECK allows null success rows'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII a–z / 0–9 / _.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('stale_send_claim' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  true,
  'ASCII snake_case provider failure code matches under COLLATE C'
);

select is(
  ('Stale_Send_Claim' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  false,
  'uppercase provider failure code is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  false,
  'empty provider failure code is rejected under COLLATE C'
);

select is(
  ('stale-send-claim' collate "C" ~ '^[a-z0-9_]{1,80}$'),
  false,
  'hyphenated provider failure code is rejected under COLLATE C'
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where conrelid = 'private.gmail_oauth_flows'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%failure_code%'
      and pg_get_constraintdef(oid) not ilike '%collate "C"%'
  ),
  0,
  'gmail_oauth_flows has no length-only or bare failure_code CHECK'
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%failure_code%'
      and pg_get_constraintdef(oid) not ilike '%collate "C"%'
  ),
  0,
  'square_oauth_flows has no length-only or bare failure_code CHECK'
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%last_error_code%'
      and pg_get_constraintdef(oid) not ilike '%collate "C"%'
  ),
  0,
  'supplier_email_deliveries has no length-only or bare last_error_code CHECK'
);

select * from finish();
rollback;
