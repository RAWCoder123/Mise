create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' audit_log_actor_evidence.test.sql
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
   'authenticated', 'authenticated', 'audit-log-actor-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Audit Log Actor Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'manager', 'active');

select has_function(
  'private',
  'enforce_audit_log_actor_evidence',
  'audit log actor evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      null,
      'null_actor_probe',
      'inventory_items',
      null,
      '{}'::jsonb
    )
  $sql$),
  'Audit log actor is required',
  'direct audit_logs insert cannot mint an unattributable null actor_user_id'
);

select is(
  pg_temp.error_of($sql$
    insert into public.audit_logs (
      id, restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      'a0000000-0000-4000-8000-0000000000aa',
      'a0000000-0000-4000-8000-00000000000a',
      'a1111111-1111-4111-8111-11111111111a',
      'attributed_actor_probe',
      'inventory_items',
      null,
      '{}'::jsonb
    )
  $sql$),
  null,
  'direct audit_logs insert with a real actor_user_id remains allowed'
);

set local role service_role;

select is(
  pg_temp.error_of($sql$
    select public.service_record_edge_audit_log(
      'a1111111-1111-4111-8111-11111111111a',
      'a0000000-0000-4000-8000-00000000000a',
      'hosted_actor_probe',
      'inventory_items',
      null,
      '{}'::jsonb
    )
  $sql$),
  null,
  'hosted service_record_edge_audit_log can still insert with an attributed actor'
);

select is(
  (
    select actor_user_id
    from public.audit_logs
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and action = 'hosted_actor_probe'
  ),
  'a1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted service_record_edge_audit_log keeps the authenticated actor_user_id'
);

reset role;

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'a1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after audit_logs history exists'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and id = 'a0000000-0000-4000-8000-0000000000aa'
      and actor_user_id is null
      and action = 'attributed_actor_probe'
  ),
  1::bigint,
  'account deletion anonymizes audit actors without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and id = 'a0000000-0000-4000-8000-0000000000aa'
      and action = 'attributed_actor_probe'
      and entity_table = 'inventory_items'
  ),
  1::bigint,
  'account deletion preserves immutable audit_logs business fields'
);

select * from finish();
rollback;
