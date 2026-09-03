begin;

select plan(11);

create or replace function pg_temp.try_execute(statement text)
returns boolean
language plpgsql
security invoker
as $$
begin
  execute statement;
  return true;
exception
  when others then
    return false;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('c1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reschedule-owner@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('c2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reschedule-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('c3333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reschedule-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('c4444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'other-reschedule-owner@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type)
values
  ('c0000000-0000-4000-8000-000000000001', 'Reschedule Kitchen A', 'Bistro'),
  ('c0000000-0000-4000-8000-000000000002', 'Reschedule Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('c0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'c2222222-2222-4222-8222-222222222222', 'manager', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'c3333333-3333-4333-8333-333333333333', 'staff', 'active'),
  ('c0000000-0000-4000-8000-000000000002', 'c4444444-4444-4444-8444-444444444444', 'owner', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);

select is(
  (public.create_restaurant_task(
    'c0000000-0000-4000-8000-000000000001', 'task-reschedule-open',
    'Prep low-stock proteins', null,
    'human', 'prep', 'high', 'now', null,
    null, null, null, 'member',
    null, 'none', '[]'::jsonb,
    null, null, null, null, null, array[]::uuid[]
  )).timing_bucket,
  'now',
  'a manager can create an open task for reschedule coverage'
);

select is(
  (public.reschedule_restaurant_task(
    'c0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
    'up_next',
    '2026-09-04T17:00:00Z'
  )).timing_bucket,
  'up_next',
  'a manager can reschedule an open task timing bucket and due time'
);

select is(
  (select due_at from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
  '2026-09-04T17:00:00Z'::timestamptz,
  'reschedule persists the requested due_at'
);

select is(
  (public.reschedule_restaurant_task(
    'c0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
    'up_next',
    '2026-09-04T17:00:00Z'
  )).updated_at,
  (select updated_at from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
  'reschedule replay stays idempotent'
);

select is(
  (select count(*) from public.activity_events where event_type = 'task_rescheduled'),
  1::bigint,
  'reschedule appends one task_rescheduled activity event'
);

select is(
  (public.reschedule_restaurant_task(
    'c0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
    'later',
    null
  )).due_at,
  null,
  'a manager can clear due_at while moving the timing bucket'
);

select is(
  pg_temp.try_execute($sql$
    select public.reschedule_restaurant_task(
      'c0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
      'never',
      null
    )
  $sql$),
  false,
  'invalid timing buckets are rejected'
);

select is(
  (public.complete_restaurant_task(
    'c0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
    'Proteins staged for service',
    '[]'::jsonb
  )).status,
  'completed',
  'manager can complete the reschedule coverage task'
);

select is(
  pg_temp.try_execute($sql$
    select public.reschedule_restaurant_task(
      'c0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
      'now',
      null
    )
  $sql$),
  false,
  'completed tasks cannot be rescheduled'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3333333-3333-4333-8333-333333333333', true);
select is(
  pg_temp.try_execute($sql$
    select public.reschedule_restaurant_task(
      'c0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-reschedule-open'),
      'now',
      null
    )
  $sql$),
  false,
  'staff cannot reschedule a restaurant task'
);
reset role;

select is(
  (select count(*) from public.restaurant_tasks where restaurant_id = 'c0000000-0000-4000-8000-000000000002'),
  0::bigint,
  'reschedule fixtures stay tenant-isolated from kitchen B'
);

select * from finish();
rollback;
