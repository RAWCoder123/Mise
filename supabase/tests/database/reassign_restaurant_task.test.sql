begin;

select plan(12);

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
  ('b1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reassign-owner@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reassign-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b3333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reassign-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b4444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'other-reassign-owner@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type)
values
  ('b0000000-0000-4000-8000-000000000001', 'Reassign Kitchen A', 'Bistro'),
  ('b0000000-0000-4000-8000-000000000002', 'Reassign Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('b0000000-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'b2222222-2222-4222-8222-222222222222', 'manager', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'b3333333-3333-4333-8333-333333333333', 'staff', 'active'),
  ('b0000000-0000-4000-8000-000000000002', 'b4444444-4444-4444-8444-444444444444', 'owner', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);

select is(
  (public.create_restaurant_task(
    'b0000000-0000-4000-8000-000000000001', 'task-reassign-open',
    'Count before service', null,
    'human', 'inventory', 'high', 'now', null,
    null, null, null, 'member',
    'b2222222-2222-4222-8222-222222222222', 'none', '[]'::jsonb,
    null, null, null, null, null, array[]::uuid[]
  )).status,
  'waiting',
  'a manager can create an open task for reassignment coverage'
);

select is(
  (public.reassign_restaurant_task(
    'b0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reassign-open'),
    'b3333333-3333-4333-8333-333333333333'
  )).assignee_user_id,
  'b3333333-3333-4333-8333-333333333333'::uuid,
  'a manager can reassign an open task to staff'
);

select is(
  (public.reassign_restaurant_task(
    'b0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reassign-open'),
    'b3333333-3333-4333-8333-333333333333'
  )).assignee_user_id,
  'b3333333-3333-4333-8333-333333333333'::uuid,
  'reassign replay stays idempotent'
);

select is(
  (select count(*) from public.activity_events where event_type = 'task_reassigned'),
  1::bigint,
  'reassign appends one task_reassigned activity event'
);

select is(
  (public.reassign_restaurant_task(
    'b0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reassign-open'),
    null
  )).assignee_user_id,
  null,
  'a manager can clear the assignee on an open task'
);

select is(
  pg_temp.try_execute($sql$
    select public.reassign_restaurant_task(
      'b0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-reassign-open'),
      'b4444444-4444-4444-8444-444444444444'
    )
  $sql$),
  false,
  'assignee must hold the required active restaurant role'
);

select is(
  (public.create_restaurant_task(
    'b0000000-0000-4000-8000-000000000001', 'task-reassign-manager-only',
    'Approve emergency order', null,
    'human', 'orders', 'urgent', 'now', null,
    null, null, null, 'manager',
    null, 'none', '[]'::jsonb,
    null, null, null, null, null, array[]::uuid[]
  )).status,
  'waiting',
  'a manager can create a manager-required task'
);

select is(
  pg_temp.try_execute($sql$
    select public.reassign_restaurant_task(
      'b0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-reassign-manager-only'),
      'b3333333-3333-4333-8333-333333333333'
    )
  $sql$),
  false,
  'staff cannot become the assignee on a manager-required task'
);

select is(
  (public.complete_restaurant_task(
    'b0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-reassign-open'),
    'Counted and staged',
    '[]'::jsonb
  )).status,
  'completed',
  'manager can complete the reassignment coverage task'
);

select is(
  pg_temp.try_execute($sql$
    select public.reassign_restaurant_task(
      'b0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-reassign-open'),
      'b3333333-3333-4333-8333-333333333333'
    )
  $sql$),
  false,
  'completed tasks cannot be reassigned'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3333333-3333-4333-8333-333333333333', true);
select is(
  pg_temp.try_execute($sql$
    select public.reassign_restaurant_task(
      'b0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-reassign-manager-only'),
      'b3333333-3333-4333-8333-333333333333'
    )
  $sql$),
  false,
  'staff cannot reassign a restaurant task'
);
reset role;

select is(
  (select count(*) from public.restaurant_tasks where restaurant_id = 'b0000000-0000-4000-8000-000000000002'),
  0::bigint,
  'reassignment fixtures stay tenant-isolated from kitchen B'
);

select * from finish();
rollback;
