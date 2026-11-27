create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' mise_actions_failure_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(7);

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
  ('f1111111-1111-4111-8111-11111111111f', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mise-actions-failure-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-00000000000f', 'Mise Actions Failure Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-00000000000f', 'f1111111-1111-4111-8111-11111111111f', 'manager', 'active');

select has_function(
  'private',
  'enforce_mise_actions_failure_evidence',
  'mise actions failure evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-00000000000f',
      'create_internal_task', 'prepare', 'failed', 2,
      'null failure evidence probe', '[]'::jsonb, 'failure-evidence-null-failed'
    )
  $sql$),
  'Mise action failure evidence is required',
  'direct mise_actions insert cannot mint failed status without error evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, error_code, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-00000000000f',
      'create_internal_task', 'prepare', 'unverified', 2,
      'blank message probe', '[]'::jsonb,
      'provider_unknown', 'failure-evidence-blank-message'
    )
  $sql$),
  'Mise action failure evidence is required',
  'direct mise_actions insert cannot mint unverified status without error_message'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, error_code, error_message, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-0000000000ff',
      'f0000000-0000-4000-8000-00000000000f',
      'create_internal_task', 'prepare', 'failed', 2,
      'stamped failure probe', '[]'::jsonb,
      'provider_not_enabled',
      'Supplier delivery is disabled for this restaurant.',
      'failure-evidence-stamped-failed'
    )
  $sql$),
  null,
  'direct mise_actions insert with error evidence remains allowed for failed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-0000000000fa',
      'f0000000-0000-4000-8000-00000000000f',
      'create_internal_task', 'prepare', 'waiting_for_approval', 2,
      'pre-failure fixture', '[]'::jsonb,
      'failure-evidence-waiting'
    )
  $sql$),
  null,
  'direct mise_actions insert can open waiting_for_approval without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, executed_at, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-0000000000fe',
      'f0000000-0000-4000-8000-00000000000f',
      'create_internal_task', 'prepare', 'executed', 2,
      'executed without failure evidence', '[]'::jsonb,
      '2026-11-27T09:00:00Z'::timestamptz,
      'failure-evidence-executed'
    )
  $sql$),
  null,
  'direct mise_actions insert can mint executed status without failure evidence'
);

insert into public.mise_actions (
  id, restaurant_id, action_type, execution_mode, status, autonomy_level,
  reason, evidence, idempotency_key
) values (
  'f0000000-0000-4000-8000-0000000000fb',
  'f0000000-0000-4000-8000-00000000000f',
  'create_internal_task', 'prepare', 'waiting_for_approval', 2,
  'failure-update fixture', '[]'::jsonb,
  'failure-evidence-failure-update'
);

select is(
  pg_temp.error_of($sql$
    update public.mise_actions
    set status = 'failed',
      error_code = 'supplier_email_rejected',
      error_message = 'Gmail definitively rejected the supplier email.',
      updated_at = now()
    where id = 'f0000000-0000-4000-8000-0000000000fb'
      and status = 'waiting_for_approval'
  $sql$),
  null,
  'failure UPDATE with evidence remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
