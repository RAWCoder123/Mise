create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' operational_finding_decision_actor_userid_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(8);

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
   'authenticated', 'authenticated', 'finding-decision-actor-userid-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Finding Decision Actor UserId Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'manager', 'active');

select has_function(
  'private',
  'enforce_operational_finding_decision_actor_userid_evidence',
  'operational finding decision actor userid evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.operational_finding_decisions (
      restaurant_id, finding_id, policy_version, decision_type,
      finding_generated_at, finding_category, severity, confidence_score,
      evidence, original_recommended_action, client_event_id, idempotency_key,
      actor_user_id
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'finding:data-gap:sales:actor-null-1',
      'beta-findings-v1',
      'dismissed',
      now(),
      'data_quality',
      'warning',
      1,
      jsonb_build_array(jsonb_build_object(
        'type', 'data_gap',
        'id', 'sales:actor-null-1',
        'observedAt', now(),
        'summary', 'Missing sales fixture'
      )),
      'Import sales.',
      'finding-actor-null-1',
      'finding-actor-null-1',
      null
    )
  $sql$),
  'Operational finding decision actor is required',
  'direct operational_finding_decisions insert cannot mint an unattributable null actor'
);

select is(
  pg_temp.error_of($sql$
    insert into public.operational_finding_decisions (
      restaurant_id, finding_id, policy_version, decision_type,
      finding_generated_at, finding_category, severity, confidence_score,
      evidence, original_recommended_action, client_event_id, idempotency_key,
      actor_user_id
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'finding:data-gap:sales:actor-ok-1',
      'beta-findings-v1',
      'dismissed',
      now(),
      'data_quality',
      'warning',
      1,
      jsonb_build_array(jsonb_build_object(
        'type', 'data_gap',
        'id', 'sales:actor-ok-1',
        'observedAt', now(),
        'summary', 'Missing sales fixture'
      )),
      'Import sales.',
      'finding-actor-ok-1',
      'finding-actor-ok-1',
      'a1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct operational_finding_decisions insert with a real actor remains allowed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_operational_finding_decision(
      'a0000000-0000-4000-8000-00000000000a',
      'finding:data-gap:sales:rpc-dismiss-1',
      'beta-findings-v1',
      'dismissed',
      now(),
      'data_quality',
      'warning',
      1,
      jsonb_build_array(jsonb_build_object(
        'type', 'data_gap',
        'id', 'sales:rpc-dismiss-1',
        'observedAt', now(),
        'summary', 'Missing sales for RPC dismiss'
      )),
      'Import sales.',
      null,
      'finding-actor-rpc-1',
      'finding-actor-rpc-1'
    )
  $sql$),
  null,
  'manager JWT can record a finding decision with auth.uid() actor attribution'
);

select is(
  (select actor_user_id from public.operational_finding_decisions
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and client_event_id = 'finding-actor-rpc-1'),
  'a1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted RPC decision keeps the authenticated actor_user_id'
);

reset role;

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'a1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after finding-decision history exists'
);

select is(
  (
    select count(*)
    from public.operational_finding_decisions
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and client_event_id = 'finding-actor-rpc-1'
      and actor_user_id is null
  ),
  1::bigint,
  'account deletion anonymizes actor_user_id without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.operational_finding_decisions
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and client_event_id = 'finding-actor-rpc-1'
      and decision_type = 'dismissed'
      and finding_id = 'finding:data-gap:sales:rpc-dismiss-1'
      and idempotency_key = 'finding-actor-rpc-1'
      and original_recommended_action = 'Import sales.'
  ),
  1::bigint,
  'account deletion preserves immutable finding-decision business fields'
);

select * from finish();
rollback;
