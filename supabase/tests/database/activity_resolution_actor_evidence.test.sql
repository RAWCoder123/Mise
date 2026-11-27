create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' activity_resolution_actor_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'activity-resolution-actor-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000c', 'Activity Resolution Actor Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000c', 'c1111111-1111-4111-8111-11111111111c', 'manager', 'active');

select has_function(
  'private',
  'enforce_activity_resolution_actor_evidence',
  'activity resolution actor evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.activity_events (
      restaurant_id, event_type, category, title, summary, occurred_at,
      source, actor_type, trigger_type, autonomy_level, status,
      idempotency_key, resolved_at
    ) values (
      'c0000000-0000-4000-8000-00000000000c',
      'task_completed', 'tasks', 'Null resolver probe',
      'Resolved without an actor.', now(),
      'mise', 'user', 'activity_resolution_actor_probe', 2, 'completed',
      'activity-resolution-actor-null-resolver', now()
    )
  $sql$),
  'Activity resolution actor is required',
  'direct activity_events insert cannot mint resolved_at without resolved_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.activity_events (
      id, restaurant_id, event_type, category, title, summary, occurred_at,
      source, actor_type, trigger_type, autonomy_level, status,
      idempotency_key, resolved_at, resolved_by
    ) values (
      'c0000000-0000-4000-8000-0000000000ca',
      'c0000000-0000-4000-8000-00000000000c',
      'task_completed', 'tasks', 'Attributed resolution probe',
      'Resolved by a real operator.', now(),
      'mise', 'user', 'activity_resolution_actor_probe', 2, 'completed',
      'activity-resolution-actor-attributed',
      now(), 'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  null,
  'direct activity_events insert with resolved_by remains allowed when resolved_at is set'
);

select is(
  pg_temp.error_of($sql$
    insert into public.activity_events (
      id, restaurant_id, event_type, category, title, summary, occurred_at,
      source, actor_type, trigger_type, autonomy_level, status,
      idempotency_key
    ) values (
      'c0000000-0000-4000-8000-0000000000cb',
      'c0000000-0000-4000-8000-00000000000c',
      'task_created', 'tasks', 'Unresolved fixture',
      'Normal unresolved activity remains insertable.', now(),
      'mise', 'system', 'activity_resolution_actor_probe', 2, 'monitoring',
      'activity-resolution-actor-unresolved'
    )
  $sql$),
  null,
  'direct activity_events insert can open unresolved rows without resolved_by'
);

select is(
  pg_temp.error_of($sql$
    select private.append_activity_event(
      'c0000000-0000-4000-8000-00000000000c',
      'task_created',
      'tasks',
      'Hosted append remains open',
      'append_activity_event still inserts unresolved activity.',
      now(),
      'mise',
      'system',
      null,
      'activity_resolution_actor_probe',
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
      'activity-resolution-actor-append'
    )
  $sql$),
  null,
  'hosted append_activity_event can still insert unresolved activity'
);

select is(
  (
    select count(*)
    from public.activity_events
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and idempotency_key = 'activity-resolution-actor-append'
      and resolved_at is null
      and resolved_by is null
  ),
  1::bigint,
  'accepted append_activity_event leaves resolution fields null'
);

select is(
  (
    select resolved_by
    from public.activity_events
    where id = 'c0000000-0000-4000-8000-0000000000ca'
  ),
  'c1111111-1111-4111-8111-11111111111c'::uuid,
  'attributed resolved insert keeps the authenticated resolved_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'c1111111-1111-4111-8111-11111111111c'
  $sql$),
  null,
  'account deletion remains allowed after activity_events history exists'
);

select is(
  (
    select count(*)
    from public.activity_events
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and id = 'c0000000-0000-4000-8000-0000000000ca'
      and resolved_by is null
      and resolved_at is not null
  ),
  1::bigint,
  'account deletion anonymizes resolution actors without clearing resolved_at'
);

select is(
  (
    select count(*)
    from public.activity_events
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and id = 'c0000000-0000-4000-8000-0000000000ca'
      and title = 'Attributed resolution probe'
      and status = 'completed'
  ),
  1::bigint,
  'account deletion preserves immutable activity_events business fields'
);

select is(
  (
    select count(*)
    from public.activity_events
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and idempotency_key = 'activity-resolution-actor-unresolved'
      and resolved_at is null
      and resolved_by is null
  ),
  1::bigint,
  'unresolved activity rows remain untouched by resolver anonymization'
);

select * from finish();
rollback;
