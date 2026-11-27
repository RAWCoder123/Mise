create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' restaurant_autonomy_rule_created_by_evidence.test.sql
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
  ('b1111111-1111-4111-8111-11111111111b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'autonomy-rule-created-by-evidence-owner@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('b0000000-0000-4000-8000-00000000000b', 'Autonomy Rule Created-By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('b0000000-0000-4000-8000-00000000000b', 'b1111111-1111-4111-8111-11111111111b', 'owner', 'active');

select has_function(
  'private',
  'enforce_restaurant_autonomy_rule_created_by_evidence',
  'restaurant autonomy rule created_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_autonomy_rules (
      restaurant_id, action_type, operational_category,
      maximum_autonomy_level, requires_approval, enabled, created_by
    ) values (
      'b0000000-0000-4000-8000-00000000000b',
      'create_internal_task', 'tasks', 2::smallint, true, false, null
    )
  $sql$),
  'Restaurant autonomy rule creator is required',
  'direct restaurant_autonomy_rules insert cannot mint an unattributable null created_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.restaurant_autonomy_rules (
      id, restaurant_id, action_type, operational_category,
      maximum_autonomy_level, requires_approval, enabled, created_by, updated_by
    ) values (
      'b0000000-0000-4000-8000-0000000000bb',
      'b0000000-0000-4000-8000-00000000000b',
      'create_internal_task', 'tasks', 2::smallint, true, false,
      'b1111111-1111-4111-8111-11111111111b',
      'b1111111-1111-4111-8111-11111111111b'
    )
  $sql$),
  null,
  'direct restaurant_autonomy_rules insert with a real created_by remains allowed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-11111111111b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.upsert_restaurant_autonomy_rule(
      'b0000000-0000-4000-8000-00000000000b',
      'recalculate_forecast',
      'inventory',
      2::smallint,
      true,
      false,
      null,
      null,
      null,
      null,
      null,
      null
    )
  $sql$),
  null,
  'hosted upsert_restaurant_autonomy_rule can still insert with an attributed creator'
);

select is(
  (
    select created_by
    from public.restaurant_autonomy_rules
    where restaurant_id = 'b0000000-0000-4000-8000-00000000000b'
      and action_type = 'recalculate_forecast'
  ),
  'b1111111-1111-4111-8111-11111111111b'::uuid,
  'accepted upsert_restaurant_autonomy_rule keeps the authenticated created_by'
);

reset role;

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'b1111111-1111-4111-8111-11111111111b'
  $sql$),
  null,
  'account deletion remains allowed after restaurant_autonomy_rules history exists'
);

select is(
  (
    select count(*)
    from public.restaurant_autonomy_rules
    where restaurant_id = 'b0000000-0000-4000-8000-00000000000b'
      and id = 'b0000000-0000-4000-8000-0000000000bb'
      and created_by is null
      and action_type = 'create_internal_task'
  ),
  1::bigint,
  'account deletion anonymizes autonomy-rule creators without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.restaurant_autonomy_rules
    where restaurant_id = 'b0000000-0000-4000-8000-00000000000b'
      and id = 'b0000000-0000-4000-8000-0000000000bb'
      and action_type = 'create_internal_task'
      and operational_category = 'tasks'
      and maximum_autonomy_level = 2
  ),
  1::bigint,
  'account deletion preserves immutable restaurant_autonomy_rules business fields'
);

select * from finish();
rollback;
