create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' mise_actions_executed_at_evidence.test.sql
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
  ('e1111111-1111-4111-8111-11111111111e', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mise-actions-executed-at-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-00000000000e', 'Mise Actions Executed-At Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-00000000000e', 'e1111111-1111-4111-8111-11111111111e', 'manager', 'active');

select has_function(
  'private',
  'enforce_mise_actions_executed_at_evidence',
  'mise actions executed_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'e0000000-0000-4000-8000-00000000000e',
      'create_internal_task', 'prepare', 'executed', 2,
      'null executed_at probe', '[]'::jsonb, 'executed-at-null-executed'
    )
  $sql$),
  'Mise action execution time is required',
  'direct mise_actions insert cannot mint executed status without executed_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, executed_at, idempotency_key
    ) values (
      'e0000000-0000-4000-8000-0000000000ee',
      'e0000000-0000-4000-8000-00000000000e',
      'create_internal_task', 'prepare', 'executed', 2,
      'stamped executed probe', '[]'::jsonb,
      '2026-11-27T08:00:00Z'::timestamptz,
      'executed-at-stamped-executed'
    )
  $sql$),
  null,
  'direct mise_actions insert with executed_at remains allowed for executed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'e0000000-0000-4000-8000-0000000000ea',
      'e0000000-0000-4000-8000-00000000000e',
      'create_internal_task', 'prepare', 'waiting_for_approval', 2,
      'pre-execution fixture', '[]'::jsonb,
      'executed-at-waiting'
    )
  $sql$),
  null,
  'direct mise_actions insert can open waiting_for_approval without executed_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'e0000000-0000-4000-8000-0000000000ef',
      'e0000000-0000-4000-8000-00000000000e',
      'create_internal_task', 'prepare', 'failed', 2,
      'failure fixture', '[]'::jsonb,
      'executed-at-failed-insert'
    )
  $sql$),
  null,
  'direct mise_actions insert can mint failed status without executed_at'
);

select is(
  pg_temp.error_of($sql$
    update public.mise_actions
    set status = 'executed',
      executed_at = '2026-11-27T08:05:00Z'::timestamptz,
      updated_at = now()
    where id = 'e0000000-0000-4000-8000-0000000000ea'
  $sql$),
  null,
  'UPDATE into executed with executed_at remains allowed (INSERT-only tip)'
);

insert into public.mise_actions (
  id, restaurant_id, action_type, execution_mode, status, autonomy_level,
  reason, evidence, idempotency_key
) values (
  'e0000000-0000-4000-8000-0000000000eb',
  'e0000000-0000-4000-8000-00000000000e',
  'create_internal_task', 'prepare', 'waiting_for_approval', 2,
  'failure-update fixture', '[]'::jsonb,
  'executed-at-failure-update'
);

select is(
  pg_temp.error_of($sql$
    update public.mise_actions
    set status = 'failed',
      error_code = 'supplier_email_rejected',
      error_message = 'Gmail definitively rejected the supplier email.',
      updated_at = now()
    where id = 'e0000000-0000-4000-8000-0000000000eb'
      and status = 'waiting_for_approval'
      and executed_at is null
  $sql$),
  null,
  'failure UPDATE may leave executed_at null on non-insert paths'
);

select * from finish();
rollback;
