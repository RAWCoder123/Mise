-- MISE-005AD: Gmail/Square OAuth state_hash CHECKs and begin/claim hex +
-- PKCE gates must use COLLATE "C" so restore/write paths cannot diverge on
-- [0-9a-f] / [A-Za-z0-9] under LC_CTYPE drift.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.gmail_oauth_flows'::regclass
      and conname = 'gmail_oauth_flows_state_hash_check'
  ),
  'gmail_oauth_flows_state_hash_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_oauth_flows'::regclass
      and conname = 'gmail_oauth_flows_state_hash_check'
  ),
  'state_hash collate "C" ~ ''\^[0-9a-f]\{64\}\$''',
  'gmail state_hash CHECK uses COLLATE C hex class'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_state_hash_check'
  ),
  'square_oauth_flows_state_hash_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.square_oauth_flows'::regclass
      and conname = 'square_oauth_flows_state_hash_check'
  ),
  'state_hash collate "C" ~ ''\^[0-9a-f]\{64\}\$''',
  'square state_hash CHECK uses COLLATE C hex class'
);

select matches(
  pg_get_functiondef(
    'private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text)'::regprocedure
  ),
  'p_state_hash collate "C" !~ ''\^[0-9a-f]\{64\}\$''',
  'begin gmail state_hash gate uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text)'::regprocedure
  ),
  'p_code_verifier collate "C" !~ ''\^\[A-Za-z0-9\._~-\]\+\$''',
  'begin gmail PKCE gate uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_claim_gmail_oauth(text)'::regprocedure
  ),
  'p_state_hash collate "C" !~ ''\^[0-9a-f]\{64\}\$''',
  'claim gmail state_hash gate uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_begin_square_oauth(uuid, uuid, uuid, text, text)'::regprocedure
  ),
  'p_state_hash collate "C" !~ ''\^[0-9a-f]\{64\}\$''',
  'begin square state_hash gate uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_begin_square_oauth(uuid, uuid, uuid, text, text)'::regprocedure
  ),
  'p_code_verifier collate "C" !~ ''\^\[A-Za-z0-9\._~-\]\+\$''',
  'begin square PKCE gate uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_claim_square_oauth(text)'::regprocedure
  ),
  'p_state_hash collate "C" !~ ''\^[0-9a-f]\{64\}\$''',
  'claim square state_hash gate uses COLLATE C'
);

select is(
  has_function_privilege(
    'service_role',
    'private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on private.service_begin_gmail_oauth'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on private.service_begin_gmail_oauth'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.service_begin_square_oauth(uuid, uuid, uuid, text, text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on private.service_begin_square_oauth'
);

select * from finish();
rollback;
