create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' activity_user_actor_evidence.test.sql
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
  ('d1111111-1111-4111-8111-11111111111d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'activity-user-actor-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-00000000000d', 'Activity User Actor Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-00000000000d', 'd1111111-1111-4111-8111-11111111111d', 'manager', 'active');

select has_function(
  'private',
  'enforce_activity_user_actor_evidence',
  'activity user actor evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.activity_events (
      restaurant_id, event_type, category, title, summary, occurred_at,
      source, actor_type, trigger_type, autonomy_level, status,
      idempotency_key
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'task_completed', 'tasks', 'Null user actor probe',
      'User-attributed activity without an actor.', now(),
      'mise', 'user', 'activity_user_actor_probe', 2, 'completed',
      'activity-user-actor-null-user'
    )
  $sql$),
  'Activity user actor is required',
  'direct activity_events insert cannot mint actor_type=user without actor_user_id'
);

select is(
  pg_temp.error_of($sql$
    insert into public.activity_events (
      id, restaurant_id, event_type, category, title, summary, occurred_at,
      source, actor_type, actor_user_id, trigger_type, autonomy_level, status,
      idempotency_key
    ) values (
      'd0000000-0000-4000-8000-0000000000da',
      'd0000000-0000-4000-8000-00000000000d',
      'task_completed', 'tasks', 'Attributed user actor probe',
      'User-attributed activity with a real operator.', now(),
      'mise', 'user', 'd1111111-1111-4111-8111-11111111111d',
      'activity_user_actor_probe', 2, 'completed',
      'activity-user-actor-attributed'
    )
  $sql$),
  null,
  'direct activity_events insert with actor_user_id remains allowed for actor_type=user'
);

select is(
  pg_temp.error_of($sql$
    insert into public.activity_events (
      id, restaurant_id, event_type, category, title, summary, occurred_at,
      source, actor_type, trigger_type, autonomy_level, status,
      idempotency_key
    ) values (
      'd0000000-0000-4000-8000-0000000000db',
      'd0000000-0000-4000-8000-00000000000d',
      'forecast_updated', 'system', 'Mise actor fixture',
      'Mise-attributed activity may leave actor_user_id null.', now(),
      'mise', 'mise', 'activity_user_actor_probe', 2, 'completed',
      'activity-user-actor-mise'
    )
  $sql$),
  null,
  'direct activity_events insert can attribute mise without actor_user_id'
);

select is(
  pg_temp.error_of($sql$
    select private.append_activity_event(
      'd0000000-0000-4000-8000-00000000000d',
      'task_created',
      'tasks',
      'Hosted append remains open for system',
      'append_activity_event still inserts system activity without a user id.',
      now(),
      'mise',
      'system',
      null,
      'activity_user_actor_probe',
      null,
      '[]'::jsonb,
      array['mise']::text[],
      null,
      null,
      2::smallint,
      null,
      'monitoring',
      false,
      null,
      null,
      null,
      null,
      null,
      null,
      'activity-user-actor-append-system'
    )
  $sql$),
  null,
  'hosted append_activity_event can still insert system activity without actor_user_id'
);

select is(
  pg_temp.error_of($sql$
    select private.append_activity_event(
      'd0000000-0000-4000-8000-00000000000d',
      'task_created',
      'tasks',
      'Hosted append rejects unattributed user',
      'append_activity_event must fail closed for actor_type=user without actor_user_id.',
      now(),
      'mise',
      'user',
      null,
      'activity_user_actor_probe',
      null,
      '[]'::jsonb,
      array['mise']::text[],
      null,
      null,
      2::smallint,
      null,
      'monitoring',
      false,
      null,
      null,
      null,
      null,
      null,
      null,
      'activity-user-actor-append-user-null'
    )
  $sql$),
  'Activity user actor is required',
  'hosted append_activity_event cannot mint actor_type=user without actor_user_id'
);

select is(
  (
    select count(*)
    from public.activity_events
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000d'
      and idempotency_key = 'activity-user-actor-append-system'
      and actor_type = 'system'
      and actor_user_id is null
  ),
  1::bigint,
  'accepted append_activity_event leaves system actor_user_id null'
);

select is(
  (
    select actor_user_id
    from public.activity_events
    where id = 'd0000000-0000-4000-8000-0000000000da'
  ),
  'd1111111-1111-4111-8111-11111111111d'::uuid,
  'attributed user insert keeps the authenticated actor_user_id'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'd1111111-1111-4111-8111-11111111111d'
  $sql$),
  null,
  'account deletion remains allowed after activity_events history exists'
);

select is(
  (
    select count(*)
    from public.activity_events
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000d'
      and id = 'd0000000-0000-4000-8000-0000000000da'
      and actor_type = 'user'
      and actor_user_id is null
  ),
  1::bigint,
  'account deletion anonymizes user actors without clearing actor_type'
);

select is(
  (
    select count(*)
    from public.activity_events
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000d'
      and id = 'd0000000-0000-4000-8000-0000000000da'
      and title = 'Attributed user actor probe'
      and status = 'completed'
  ),
  1::bigint,
  'account deletion preserves immutable activity_events business fields'
);

select * from finish();
rollback;
