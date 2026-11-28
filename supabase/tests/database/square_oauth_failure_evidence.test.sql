create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' square_oauth_failure_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(9);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'square-oauth-failure-evidence-owner@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Square OAuth Failure Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'owner', 'active');

-- Callback reservations required by square_oauth_flows FK.
insert into private.edge_function_security_events (
  id, restaurant_id, actor_user_id, function_name, event_type, action
) values
  ('a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-00000000000a',
   'a1111111-1111-4111-8111-11111111111a', 'square-oauth-callback', 'allowed', 'reserve'),
  ('a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-00000000000a',
   'a1111111-1111-4111-8111-11111111111a', 'square-oauth-callback', 'allowed', 'reserve'),
  ('a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-00000000000a',
   'a1111111-1111-4111-8111-11111111111a', 'square-oauth-callback', 'allowed', 'reserve'),
  ('a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-00000000000a',
   'a1111111-1111-4111-8111-11111111111a', 'square-oauth-callback', 'allowed', 'reserve'),
  ('a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-00000000000a',
   'a1111111-1111-4111-8111-11111111111a', 'square-oauth-callback', 'allowed', 'reserve'),
  ('a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-00000000000a',
   'a1111111-1111-4111-8111-11111111111a', 'square-oauth-callback', 'allowed', 'reserve'),
  ('a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-00000000000a',
   'a1111111-1111-4111-8111-11111111111a', 'square-oauth-callback', 'allowed', 'reserve');

select has_function(
  'private',
  'enforce_square_oauth_failure_evidence',
  'square oauth failure evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into private.square_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, failed_at
    ) values (
      'a0000000-0000-4000-8000-000000000201',
      'a0000000-0000-4000-8000-00000000000a',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000901',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'a0000000-0000-4000-8000-000000000801',
      now() + interval '10 minutes',
      now()
    )
  $sql$),
  'Square OAuth failure evidence is required',
  'direct square_oauth_flows insert cannot mint failed_at without failure_code'
);

select is(
  pg_temp.error_of($sql$
    insert into private.square_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, failed_at, failure_code
    ) values (
      'a0000000-0000-4000-8000-000000000202',
      'a0000000-0000-4000-8000-00000000000a',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000902',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'a0000000-0000-4000-8000-000000000802',
      now() + interval '10 minutes',
      now(),
      '   '
    )
  $sql$),
  'Square OAuth failure evidence is required',
  'direct square_oauth_flows insert cannot mint failed_at with blank failure_code'
);

select is(
  pg_temp.error_of($sql$
    insert into private.square_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, failed_at, failure_code
    ) values (
      'a0000000-0000-4000-8000-000000000203',
      'a0000000-0000-4000-8000-00000000000a',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000903',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'a0000000-0000-4000-8000-000000000803',
      now() + interval '10 minutes',
      now(),
      'provider_denied'
    )
  $sql$),
  null,
  'direct square_oauth_flows insert with failure_code remains allowed when failed_at is set'
);

select is(
  pg_temp.error_of($sql$
    insert into private.square_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at
    ) values (
      'a0000000-0000-4000-8000-000000000204',
      'a0000000-0000-4000-8000-00000000000a',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000904',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'a0000000-0000-4000-8000-000000000804',
      now() + interval '10 minutes'
    )
  $sql$),
  null,
  'direct square_oauth_flows insert can open a flow without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into private.square_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, completed_at
    ) values (
      'a0000000-0000-4000-8000-000000000205',
      'a0000000-0000-4000-8000-00000000000a',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000905',
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'a0000000-0000-4000-8000-000000000805',
      now() + interval '10 minutes',
      now()
    )
  $sql$),
  null,
  'direct square_oauth_flows insert can mint completed_at without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into private.square_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, failed_at, failure_code
    ) values (
      'a0000000-0000-4000-8000-000000000206',
      'a0000000-0000-4000-8000-00000000000a',
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-000000000906',
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      'a0000000-0000-4000-8000-000000000806',
      now() + interval '10 minutes',
      now(),
      'superseded'
    )
  $sql$),
  null,
  'direct square_oauth_flows insert with superseded failure_code remains allowed'
);

insert into private.square_oauth_flows (
  id, restaurant_id, actor_user_id, callback_reservation_id,
  state_hash, pkce_verifier_secret_id, expires_at
) values (
  'a0000000-0000-4000-8000-000000000207',
  'a0000000-0000-4000-8000-00000000000a',
  'a1111111-1111-4111-8111-11111111111a',
  'a0000000-0000-4000-8000-000000000907',
  '1111111111111111111111111111111111111111111111111111111111111111',
  'a0000000-0000-4000-8000-000000000807',
  now() + interval '10 minutes'
);

select is(
  pg_temp.error_of($sql$
    update private.square_oauth_flows
    set failed_at = now(),
      failure_code = 'provider_denied'
    where id = 'a0000000-0000-4000-8000-000000000207'
      and failed_at is null
  $sql$),
  null,
  'failure UPDATE with evidence remains allowed (INSERT-only tip)'
);

select is(
  pg_temp.error_of($sql$
    update private.square_oauth_flows
    set failed_at = now()
    where id = 'a0000000-0000-4000-8000-000000000204'
      and failed_at is null
  $sql$),
  null,
  'failure UPDATE without failure_code remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
