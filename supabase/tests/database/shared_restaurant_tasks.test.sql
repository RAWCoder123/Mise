begin;

select plan(36);

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
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'task-owner@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'task-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a3333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'task-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('a4444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'other-task-owner@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type)
values
  ('a0000000-0000-4000-8000-000000000001', 'Task Kitchen A', 'Bistro'),
  ('a0000000-0000-4000-8000-000000000002', 'Task Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'manager', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'a3333333-3333-4333-8333-333333333333', 'staff', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'a4444444-4444-4444-8444-444444444444', 'owner', 'active');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.restaurant_tasks'::regclass),
  'restaurant tasks have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.restaurant_task_dependencies'::regclass),
  'task dependencies have RLS enabled'
);
select is(has_table_privilege('anon', 'public.restaurant_tasks', 'SELECT'), false, 'anonymous clients cannot read tasks');
select is(has_table_privilege('authenticated', 'public.restaurant_tasks', 'INSERT'), false, 'authenticated clients cannot insert tasks directly');
select is(has_table_privilege('authenticated', 'public.restaurant_tasks', 'UPDATE'), false, 'authenticated clients cannot update tasks directly');
select is(has_table_privilege('authenticated', 'public.restaurant_task_dependencies', 'INSERT'), false, 'authenticated clients cannot forge dependencies');
select is(has_function_privilege('anon', 'public.create_restaurant_task(uuid,text,text,text,text,text,text,text,timestamptz,text,timestamptz,timestamptz,text,uuid,text,jsonb,uuid,uuid,uuid,text,text,uuid[])', 'EXECUTE'), false, 'anonymous clients cannot call task creation');
select is(has_function_privilege('authenticated', 'public.create_restaurant_task(uuid,text,text,text,text,text,text,text,timestamptz,text,timestamptz,timestamptz,text,uuid,text,jsonb,uuid,uuid,uuid,text,text,uuid[])', 'EXECUTE'), true, 'authenticated clients can call bounded task creation');
select is(has_function_privilege('authenticated', 'private.append_restaurant_task_activity(public.restaurant_tasks,text,text,text,text,text,jsonb)', 'EXECUTE'), false, 'clients cannot forge task activity through the private helper');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);

select is(
  (public.create_restaurant_task(
    'a0000000-0000-4000-8000-000000000001', 'task-count-chicken',
    'Confirm chicken count', 'Count the walk-in case before ordering.',
    'human', 'inventory', 'urgent', 'now', now() + interval '30 minutes',
    'before_supplier_cutoff', null, null, 'member',
    'a3333333-3333-4333-8333-333333333333', 'count',
    '[{"label":"Record the physical count"}]'::jsonb,
    null, null, null, 'Regional Protein Co', 'inventory-risk:chicken', array[]::uuid[]
  )).status,
  'waiting',
  'a manager can create an assigned verification task'
);

select ok(
  (public.create_restaurant_task(
    'a0000000-0000-4000-8000-000000000001', 'task-count-chicken',
    'Confirm chicken count', 'Count the walk-in case before ordering.',
    'human', 'inventory', 'urgent', 'now', now() + interval '30 minutes',
    'before_supplier_cutoff', null, null, 'member',
    'a3333333-3333-4333-8333-333333333333', 'count',
    '[{"label":"Record the physical count"}]'::jsonb,
    null, null, null, 'Regional Protein Co', 'inventory-risk:chicken', array[]::uuid[]
  )).id = (
    select id from public.restaurant_tasks
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and client_task_id = 'task-count-chicken'
  ),
  'task creation replay returns the original row'
);

select is((select count(*) from public.restaurant_tasks where client_task_id = 'task-count-chicken'), 1::bigint, 'task creation is idempotent');
select is((select count(*) from public.activity_events where idempotency_key like 'restaurant_task:%:created'), 1::bigint, 'task creation appends one truthful activity event');
select is((select category from public.activity_events where idempotency_key like 'restaurant_task:%:created'), 'tasks', 'task activity uses the task category');

select is(
  (public.create_restaurant_task(
    'a0000000-0000-4000-8000-000000000001', 'task-order-chicken',
    'Review emergency chicken order', 'Use the verified count before approval.',
    'approval', 'orders', 'high', 'up_next', now() + interval '45 minutes',
    'before_supplier_cutoff', null, null, 'manager', null, 'manager_review',
    '[]'::jsonb, null, null, null, 'Regional Protein Co', 'order-risk:chicken',
    array[(select id from public.restaurant_tasks where client_task_id = 'task-count-chicken')]
  )).status,
  'blocked',
  'a dependent task starts blocked'
);
select is((select count(*) from public.restaurant_task_dependencies), 1::bigint, 'the same-tenant dependency is persisted');
select is(
  pg_temp.try_execute($sql$
    select public.create_restaurant_task(
      'a0000000-0000-4000-8000-000000000001', 'task-order-chicken',
      'Review emergency chicken order', 'Use the verified count before approval.',
      'approval', 'orders', 'high', 'up_next', now() + interval '45 minutes',
      'before_supplier_cutoff', null, null, 'manager', null, 'manager_review',
      '[]'::jsonb, null, null, null, 'Regional Protein Co', 'order-risk:chicken',
      array[]::uuid[]
    )
  $sql$),
  false,
  'task creation replay rejects a changed dependency payload'
);
select is(
  (select count(*) from public.restaurant_task_dependencies),
  1::bigint,
  'a rejected replay cannot alter the persisted dependency graph'
);

select is(
  pg_temp.try_execute($sql$
    select public.complete_restaurant_task(
      'a0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-count-chicken'),
      'Counted 18 lb', '[]'::jsonb
    )
  $sql$),
  false,
  'verification-required tasks reject evidence-free completion'
);

select is(
  pg_temp.try_execute($sql$
    select public.complete_restaurant_task(
      'a0000000-0000-4000-8000-000000000001',
      (select id from public.restaurant_tasks where client_task_id = 'task-count-chicken'),
      'Counted 18 lb',
      '[{"type":"count","quantity":18,"unit":"lb"}]'::jsonb
    )
  $sql$),
  false,
  'count verification rejects free-text count notes without a live session'
);

reset role;

insert into public.inventory_count_sessions (
  id, restaurant_id, status, started_by, submitted_by,
  started_at, submitted_at, note, created_at, updated_at
) values (
  'a5555555-5555-4555-8555-555555555555',
  'a0000000-0000-4000-8000-000000000001',
  'submitted',
  'a3333333-3333-4333-8333-333333333333',
  'a3333333-3333-4333-8333-333333333333',
  now() - interval '20 minutes',
  now() - interval '5 minutes',
  'Chicken walk-in count',
  now() - interval '20 minutes',
  now() - interval '5 minutes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3333333-3333-4333-8333-333333333333', true);
select is(
  (public.complete_restaurant_task(
    'a0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-count-chicken'),
    'Counted 18 lb; count entered at 3:12 PM.',
    jsonb_build_array(
      jsonb_build_object(
        'type', 'count_session',
        'countSessionId', 'a5555555-5555-4555-8555-555555555555',
        'status', 'submitted'
      )
    )
  )).status,
  'completed',
  'the assigned staff member can complete with a linked submitted count session'
);
reset role;

select is((select status from public.restaurant_tasks where client_task_id = 'task-order-chicken'), 'waiting', 'completing the prerequisite unblocks its dependent task');
select is((select count(*) from public.activity_events where event_type = 'task_completed'), 1::bigint, 'completion appends one activity event');
select ok(
  (select summary like '%Counted 18 lb%' from public.activity_events where event_type = 'task_completed'),
  'completion activity includes the actual result'
);
select is((select count(*) from public.activity_events where event_type = 'task_unblocked'), 1::bigint, 'dependency release is visible in activity');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3333333-3333-4333-8333-333333333333', true);
select is(
  pg_temp.try_execute($sql$
    select public.create_restaurant_task(
      'a0000000-0000-4000-8000-000000000001', 'staff-fake-mise-task',
      'Pretend automated task', null, 'mise', 'other', 'normal', 'now',
      null, null, null, null, 'member', null, 'none', '[]'::jsonb,
      null, null, null, null, null, array[]::uuid[]
    )
  $sql$),
  false,
  'staff cannot fabricate a Mise-created task'
);
select is(
  pg_temp.try_execute($sql$
    select public.create_restaurant_task(
      'a0000000-0000-4000-8000-000000000002', 'cross-tenant-task',
      'Cross tenant task', null, 'human', 'other', 'normal', 'now',
      null, null, null, null, 'member', null, 'none', '[]'::jsonb,
      null, null, null, null, null, array[]::uuid[]
    )
  $sql$),
  false,
  'members cannot create tasks for another restaurant'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-8444-444444444444', true);
select is((select count(*) from public.restaurant_tasks), 0::bigint, 'RLS hides another tenant task rows');
select is((select count(*) from public.restaurant_task_dependencies), 0::bigint, 'RLS hides another tenant dependency rows');
reset role;

set local role service_role;
select is(
  pg_temp.try_execute(format(
    'insert into public.restaurant_task_dependencies (restaurant_id, task_id, depends_on_task_id, created_by) values (%L, %L, %L, %L)',
    'a0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-count-chicken'),
    (select id from public.restaurant_tasks where client_task_id = 'task-order-chicken'),
    'a2222222-2222-4222-8222-222222222222'
  )),
  false,
  'dependency cycles are rejected'
);
select is(
  pg_temp.try_execute($sql$
    update public.restaurant_tasks
    set assignee_user_id = 'a4444444-4444-4444-8444-444444444444'
    where client_task_id = 'task-order-chicken'
  $sql$),
  false,
  'a task cannot be assigned to another tenant member'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
select is(
  (public.complete_restaurant_task(
    'a0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-order-chicken'),
    'Manager reviewed the count and approved the next ordering decision.',
    '[{"type":"manager_review","reviewed":true}]'::jsonb
  )).status,
  'completed',
  'a manager can complete the unblocked approval task'
);
select is(
  (public.reopen_restaurant_task(
    'a0000000-0000-4000-8000-000000000001',
    (select id from public.restaurant_tasks where client_task_id = 'task-order-chicken')
  )).status,
  'waiting',
  'a manager can reopen a completed task'
);
reset role;

select is((select completion_result from public.restaurant_tasks where client_task_id = 'task-order-chicken'), null, 'reopening clears the stale completion result');
select is((select count(*) from public.activity_events where event_type = 'task_reopened'), 1::bigint, 'reopening is auditable');
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.restaurant_tasks'::regclass
      and tgname = 'enforce_authenticated_operational_mode'
      and not tgisinternal
  ),
  'restaurant tasks inherit the operational-mode guard'
);

select * from finish();
rollback;
