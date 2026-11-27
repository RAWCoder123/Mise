create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' mise_actions_decision_actor_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(11);

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
  ('f1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mise-actions-decision-actor-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-00000000000a', 'Mise Actions Decision Actor Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-00000000000a', 'f1111111-1111-4111-8111-11111111111a', 'manager', 'active');

select has_function(
  'private',
  'enforce_mise_actions_decision_actor_evidence',
  'mise actions decision actor evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'approved', 2,
      'null approver probe', '[]'::jsonb, 'decision-actor-null-approved'
    )
  $sql$),
  'Mise action decision actor is required',
  'direct mise_actions insert cannot mint approved status without approved_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'rejected', 2,
      'null rejector probe', '[]'::jsonb, 'decision-actor-null-rejected'
    )
  $sql$),
  'Mise action decision actor is required',
  'direct mise_actions insert cannot mint rejected status without approved_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, approved_by, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-0000000000ab',
      'f0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'approved', 2,
      'attributed approve probe', '[]'::jsonb,
      'f1111111-1111-4111-8111-11111111111a',
      'decision-actor-attributed-approved'
    )
  $sql$),
  null,
  'direct mise_actions insert with approved_by remains allowed for approved status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, approved_by, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-0000000000aa',
      'f0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'rejected', 2,
      'attributed reject probe', '[]'::jsonb,
      'f1111111-1111-4111-8111-11111111111a',
      'decision-actor-attributed-rejected'
    )
  $sql$),
  null,
  'direct mise_actions insert with approved_by remains allowed for rejected status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-0000000000ac',
      'f0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'waiting_for_approval', 2,
      'pre-decision fixture', '[]'::jsonb,
      'decision-actor-waiting'
    )
  $sql$),
  null,
  'direct mise_actions insert can open waiting_for_approval without approved_by'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.decide_mise_action(
      'f0000000-0000-4000-8000-00000000000a',
      'f0000000-0000-4000-8000-0000000000ac',
      'approved'
    )
  $sql$),
  null,
  'hosted decide_mise_action can approve a waiting action'
);

reset role;

select is(
  (
    select approved_by
    from public.mise_actions
    where id = 'f0000000-0000-4000-8000-0000000000ac'
  ),
  'f1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted decide_mise_action keeps the authenticated approved_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'f1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after mise_actions history exists'
);

select is(
  (
    select count(*)
    from public.mise_actions
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000a'
      and id = 'f0000000-0000-4000-8000-0000000000aa'
      and approved_by is null
      and status = 'rejected'
  ),
  1::bigint,
  'account deletion anonymizes decision actors without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.mise_actions
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000a'
      and id = 'f0000000-0000-4000-8000-0000000000aa'
      and status = 'rejected'
      and reason = 'attributed reject probe'
  ),
  1::bigint,
  'account deletion preserves immutable mise_actions business fields'
);

select * from finish();
rollback;
