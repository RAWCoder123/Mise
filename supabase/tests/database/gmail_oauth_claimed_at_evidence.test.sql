create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' gmail_oauth_claimed_at_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'gmail-oauth-claimed-at-evidence-owner@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000c', 'Gmail OAuth Claimed-At Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000c', 'c1111111-1111-4111-8111-11111111111c', 'owner', 'active');

-- Callback reservations required by gmail_oauth_flows FK.
insert into private.edge_function_security_events (
  id, restaurant_id, actor_user_id, function_name, event_type, action
) values
  ('c0000000-0000-4000-8000-000000000901', 'c0000000-0000-4000-8000-00000000000c',
   'c1111111-1111-4111-8111-11111111111c', 'gmail-oauth-callback', 'allowed', 'reserve'),
  ('c0000000-0000-4000-8000-000000000902', 'c0000000-0000-4000-8000-00000000000c',
   'c1111111-1111-4111-8111-11111111111c', 'gmail-oauth-callback', 'allowed', 'reserve'),
  ('c0000000-0000-4000-8000-000000000903', 'c0000000-0000-4000-8000-00000000000c',
   'c1111111-1111-4111-8111-11111111111c', 'gmail-oauth-callback', 'allowed', 'reserve'),
  ('c0000000-0000-4000-8000-000000000904', 'c0000000-0000-4000-8000-00000000000c',
   'c1111111-1111-4111-8111-11111111111c', 'gmail-oauth-callback', 'allowed', 'reserve'),
  ('c0000000-0000-4000-8000-000000000905', 'c0000000-0000-4000-8000-00000000000c',
   'c1111111-1111-4111-8111-11111111111c', 'gmail-oauth-callback', 'allowed', 'reserve'),
  ('c0000000-0000-4000-8000-000000000906', 'c0000000-0000-4000-8000-00000000000c',
   'c1111111-1111-4111-8111-11111111111c', 'gmail-oauth-callback', 'allowed', 'reserve'),
  ('c0000000-0000-4000-8000-000000000907', 'c0000000-0000-4000-8000-00000000000c',
   'c1111111-1111-4111-8111-11111111111c', 'gmail-oauth-callback', 'allowed', 'reserve');

select has_function(
  'private',
  'enforce_gmail_oauth_claimed_at_evidence',
  'gmail oauth claimed_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into private.gmail_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, completed_at
    ) values (
      'c0000000-0000-4000-8000-000000000201',
      'c0000000-0000-4000-8000-00000000000c',
      'c1111111-1111-4111-8111-11111111111c',
      'c0000000-0000-4000-8000-000000000901',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'c0000000-0000-4000-8000-000000000801',
      now() + interval '10 minutes',
      now()
    )
  $sql$),
  'Gmail OAuth claim time evidence is required',
  'direct gmail_oauth_flows insert cannot mint completed_at without claimed_at'
);

select is(
  pg_temp.error_of($sql$
    insert into private.gmail_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, completed_at, claimed_at
    ) values (
      'c0000000-0000-4000-8000-000000000202',
      'c0000000-0000-4000-8000-00000000000c',
      'c1111111-1111-4111-8111-11111111111c',
      'c0000000-0000-4000-8000-000000000902',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'c0000000-0000-4000-8000-000000000802',
      now() + interval '10 minutes',
      now(),
      now() - interval '1 minute'
    )
  $sql$),
  null,
  'direct gmail_oauth_flows insert with claimed_at remains allowed when completed_at is set'
);

select is(
  pg_temp.error_of($sql$
    insert into private.gmail_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at
    ) values (
      'c0000000-0000-4000-8000-000000000203',
      'c0000000-0000-4000-8000-00000000000c',
      'c1111111-1111-4111-8111-11111111111c',
      'c0000000-0000-4000-8000-000000000903',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'c0000000-0000-4000-8000-000000000803',
      now() + interval '10 minutes'
    )
  $sql$),
  null,
  'direct gmail_oauth_flows insert can open a flow without claim evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into private.gmail_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, failed_at, failure_code
    ) values (
      'c0000000-0000-4000-8000-000000000204',
      'c0000000-0000-4000-8000-00000000000c',
      'c1111111-1111-4111-8111-11111111111c',
      'c0000000-0000-4000-8000-000000000904',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'c0000000-0000-4000-8000-000000000804',
      now() + interval '10 minutes',
      now(),
      'provider_denied'
    )
  $sql$),
  null,
  'direct gmail_oauth_flows insert can mint failed_at without claimed_at'
);

select is(
  pg_temp.error_of($sql$
    insert into private.gmail_oauth_flows (
      id, restaurant_id, actor_user_id, callback_reservation_id,
      state_hash, pkce_verifier_secret_id, expires_at, claimed_at
    ) values (
      'c0000000-0000-4000-8000-000000000205',
      'c0000000-0000-4000-8000-00000000000c',
      'c1111111-1111-4111-8111-11111111111c',
      'c0000000-0000-4000-8000-000000000905',
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'c0000000-0000-4000-8000-000000000805',
      now() + interval '10 minutes',
      now()
    )
  $sql$),
  null,
  'direct gmail_oauth_flows insert can mint claimed_at without completed_at'
);

insert into private.gmail_oauth_flows (
  id, restaurant_id, actor_user_id, callback_reservation_id,
  state_hash, pkce_verifier_secret_id, expires_at
) values (
  'c0000000-0000-4000-8000-000000000206',
  'c0000000-0000-4000-8000-00000000000c',
  'c1111111-1111-4111-8111-11111111111c',
  'c0000000-0000-4000-8000-000000000906',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'c0000000-0000-4000-8000-000000000806',
  now() + interval '10 minutes'
);

select is(
  pg_temp.error_of($sql$
    update private.gmail_oauth_flows
    set claimed_at = now()
    where id = 'c0000000-0000-4000-8000-000000000206'
      and claimed_at is null
  $sql$),
  null,
  'claim UPDATE remains allowed (INSERT-only tip)'
);

select is(
  pg_temp.error_of($sql$
    update private.gmail_oauth_flows
    set completed_at = now()
    where id = 'c0000000-0000-4000-8000-000000000206'
      and completed_at is null
      and claimed_at is not null
  $sql$),
  null,
  'complete UPDATE after claim remains allowed (INSERT-only tip)'
);

insert into private.gmail_oauth_flows (
  id, restaurant_id, actor_user_id, callback_reservation_id,
  state_hash, pkce_verifier_secret_id, expires_at
) values (
  'c0000000-0000-4000-8000-000000000207',
  'c0000000-0000-4000-8000-00000000000c',
  'c1111111-1111-4111-8111-11111111111c',
  'c0000000-0000-4000-8000-000000000907',
  '1111111111111111111111111111111111111111111111111111111111111111',
  'c0000000-0000-4000-8000-000000000807',
  now() + interval '10 minutes'
);

select is(
  pg_temp.error_of($sql$
    update private.gmail_oauth_flows
    set completed_at = now()
    where id = 'c0000000-0000-4000-8000-000000000207'
      and completed_at is null
      and claimed_at is null
  $sql$),
  null,
  'complete UPDATE without claimed_at remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
