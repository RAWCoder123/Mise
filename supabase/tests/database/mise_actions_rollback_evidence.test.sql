create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' mise_actions_rollback_evidence.test.sql
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
  ('a1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mise-actions-rollback-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Mise Actions Rollback Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'manager', 'active');

select has_function(
  'private',
  'enforce_mise_actions_rollback_evidence',
  'mise actions rollback evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'reversed', 2,
      'null rollback evidence probe', '[]'::jsonb, 'rollback-evidence-null-reversed'
    )
  $sql$),
  'Mise action rollback evidence is required',
  'direct mise_actions insert cannot mint reversed status without rollback_reference'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, rollback_reference, idempotency_key
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'reversed', 2,
      'blank rollback probe', '[]'::jsonb,
      '   ', 'rollback-evidence-blank-reversed'
    )
  $sql$),
  'Mise action rollback evidence is required',
  'direct mise_actions insert cannot mint reversed status with blank rollback_reference'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, rollback_reference, idempotency_key
    ) values (
      'a0000000-0000-4000-8000-0000000000aa',
      'a0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'reversed', 2,
      'stamped rollback probe', '[]'::jsonb,
      'rollback:supplier_order:a0000000-0000-4000-8000-0000000000aa',
      'rollback-evidence-stamped-reversed'
    )
  $sql$),
  null,
  'direct mise_actions insert with rollback evidence remains allowed for reversed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, idempotency_key
    ) values (
      'a0000000-0000-4000-8000-0000000000ab',
      'a0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'waiting_for_approval', 2,
      'pre-reversal fixture', '[]'::jsonb,
      'rollback-evidence-waiting'
    )
  $sql$),
  null,
  'direct mise_actions insert can open waiting_for_approval without rollback evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into public.mise_actions (
      id, restaurant_id, action_type, execution_mode, status, autonomy_level,
      reason, evidence, executed_at, idempotency_key
    ) values (
      'a0000000-0000-4000-8000-0000000000ac',
      'a0000000-0000-4000-8000-00000000000a',
      'create_internal_task', 'prepare', 'executed', 2,
      'executed without rollback evidence', '[]'::jsonb,
      '2026-11-27T10:00:00Z'::timestamptz,
      'rollback-evidence-executed'
    )
  $sql$),
  null,
  'direct mise_actions insert can mint executed status without rollback evidence'
);

insert into public.mise_actions (
  id, restaurant_id, action_type, execution_mode, status, autonomy_level,
  reason, evidence, executed_at, idempotency_key
) values (
  'a0000000-0000-4000-8000-0000000000ad',
  'a0000000-0000-4000-8000-00000000000a',
  'create_internal_task', 'prepare', 'executed', 2,
  'reversal-update fixture', '[]'::jsonb,
  '2026-11-27T10:00:00Z'::timestamptz,
  'rollback-evidence-reversal-update'
);

select is(
  pg_temp.error_of($sql$
    update public.mise_actions
    set status = 'reversed',
      rollback_reference = 'rollback:supplier_order:a0000000-0000-4000-8000-0000000000ad',
      updated_at = now()
    where id = 'a0000000-0000-4000-8000-0000000000ad'
      and status = 'executed'
  $sql$),
  null,
  'reversal UPDATE with evidence remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
