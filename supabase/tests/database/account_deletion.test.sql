begin;

select plan(19);

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
  (
    'a1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'delete-sole-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'delete-shared-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'delete-shared-coowner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a4444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'delete-retry-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a5555555-5555-4555-8555-555555555555',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'delete-race-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a6666666-6666-4666-8666-666666666666',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'delete-race-coowner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.users (id, email, name, role, restaurant_id)
values
  ('a1111111-1111-4111-8111-111111111111', 'delete-sole-owner@mise.test', 'Sole Owner', 'owner', null),
  ('a2222222-2222-4222-8222-222222222222', 'delete-shared-owner@mise.test', 'Shared Owner', 'owner', null),
  ('a3333333-3333-4333-8333-333333333333', 'delete-shared-coowner@mise.test', 'Shared Coowner', 'owner', null),
  ('a4444444-4444-4444-8444-444444444444', 'delete-retry-owner@mise.test', 'Retry Owner', 'owner', null),
  ('a5555555-5555-4555-8555-555555555555', 'delete-race-owner@mise.test', 'Race Owner', 'owner', null),
  ('a6666666-6666-4666-8666-666666666666', 'delete-race-coowner@mise.test', 'Race Coowner', 'owner', null);

insert into public.restaurants (id, name, cuisine_type)
values
  ('a0000000-0000-4000-8000-000000000001', 'Sole Owner Kitchen', 'Cafe'),
  ('a0000000-0000-4000-8000-000000000002', 'Shared Kitchen', 'Bistro'),
  ('a0000000-0000-4000-8000-000000000003', 'Retry Kitchen', 'Cafe'),
  ('a0000000-0000-4000-8000-000000000004', 'Race Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'a2222222-2222-4222-8222-222222222222', 'owner', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'a3333333-3333-4333-8333-333333333333', 'owner', 'active'),
  ('a0000000-0000-4000-8000-000000000003', 'a4444444-4444-4444-8444-444444444444', 'owner', 'active'),
  ('a0000000-0000-4000-8000-000000000004', 'a5555555-5555-4555-8555-555555555555', 'owner', 'active');

select is(
  has_function_privilege('authenticated', 'public.service_plan_account_deletion(uuid,uuid)', 'EXECUTE'),
  false,
  'authenticated clients cannot plan account deletion'
);
select is(
  has_function_privilege('authenticated', 'public.service_finalize_account_deletion(uuid,text)', 'EXECUTE'),
  false,
  'authenticated clients cannot finalize account deletion'
);
select is(
  has_function_privilege('service_role', 'public.service_plan_account_deletion(uuid,uuid)', 'EXECUTE'),
  true,
  'service_role can plan account deletion'
);
select is(
  has_function_privilege('service_role', 'public.service_finalize_account_deletion(uuid,text)', 'EXECUTE'),
  true,
  'service_role can finalize account deletion'
);

-- Failure boundary 1: auth deletion fails -> plan marks failed, memberships remain, retryable.
with plan as (
  select public.service_plan_account_deletion(
    'a4444444-4444-4444-8444-444444444444',
    'a0000000-0000-4000-8000-000000000003'
  ) as payload
)
select ok(
  (
    select
      payload->>'phase' = 'deletion_planned'
      and payload ? 'audit_id'
      and payload->'owner_restaurant_candidates'->>0 = 'a0000000-0000-4000-8000-000000000003'
    from plan
  ),
  'plan writes deletion_planned with owner-restaurant candidates and no tenant wipe'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_memberships
    where user_id = 'a4444444-4444-4444-8444-444444444444'
      and status = 'active'
  ),
  1,
  'planning leaves active memberships intact'
);

select ok(
  (
    select
      (public.service_finalize_account_deletion(
        (
          select id
          from private.account_deletion_audit
          where planned_user_id = 'a4444444-4444-4444-8444-444444444444'
          order by created_at desc
          limit 1
        ),
        'auth_deletion_failed'
      )->>'phase') = 'auth_deletion_failed'
  ),
  'auth failure finalizer records auth_deletion_failed'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_memberships
    where user_id = 'a4444444-4444-4444-8444-444444444444'
      and restaurant_id = 'a0000000-0000-4000-8000-000000000003'
      and status = 'active'
  ),
  1,
  'auth failure leaves membership intact so client retry can re-authorize'
);

select is(
  (
    select count(*)::integer
    from public.restaurants
    where id = 'a0000000-0000-4000-8000-000000000003'
  ),
  1,
  'auth failure leaves restaurants intact'
);

-- Sole-owner: plan candidate + auth cascade + finalize deletes the orphaned restaurant.
select public.service_plan_account_deletion(
  'a1111111-1111-4111-8111-111111111111',
  'a0000000-0000-4000-8000-000000000001'
);

delete from auth.users
where id = 'a1111111-1111-4111-8111-111111111111';

select is(
  (
    public.service_finalize_account_deletion(
      (
        select id
        from private.account_deletion_audit
        where planned_user_id = 'a1111111-1111-4111-8111-111111111111'
        order by created_at desc
        limit 1
      ),
      'auth_deletion_completed'
    )->>'phase'
  ),
  'tenant_cleanup_completed',
  'post-auth finalize cleans tenant data by audit_id after auth user is gone'
);

select is(
  (select count(*)::integer from public.restaurants where id = 'a0000000-0000-4000-8000-000000000001'),
  0,
  'sole-owner restaurant is removed during post-auth finalize from durable candidates'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_memberships
    where user_id = 'a1111111-1111-4111-8111-111111111111'
  ),
  0,
  'planned user memberships are gone after auth cascade / finalize'
);

select is(
  (
    select metadata->>'phase'
    from private.account_deletion_audit
    where planned_user_id = 'a1111111-1111-4111-8111-111111111111'
    order by created_at desc
    limit 1
  ),
  'tenant_cleanup_completed',
  'durable audit ends at tenant_cleanup_completed'
);

-- Shared owner at plan time: co-owned restaurant survives finalize.
select public.service_plan_account_deletion(
  'a2222222-2222-4222-8222-222222222222',
  'a0000000-0000-4000-8000-000000000002'
);

delete from auth.users
where id = 'a2222222-2222-4222-8222-222222222222';

select is(
  (
    public.service_finalize_account_deletion(
      (
        select id
        from private.account_deletion_audit
        where planned_user_id = 'a2222222-2222-4222-8222-222222222222'
        order by created_at desc
        limit 1
      ),
      'auth_deletion_completed'
    )->>'restaurants_deleted'
  ),
  '0',
  'shared-owner finalize does not delete a co-owned restaurant'
);

select is(
  (
    select count(*)::integer
    from public.restaurants
    where id = 'a0000000-0000-4000-8000-000000000002'
  ),
  1,
  'shared-owner restaurant survives after one owner deletes their account'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_memberships
    where restaurant_id = 'a0000000-0000-4000-8000-000000000002'
      and user_id = 'a3333333-3333-4333-8333-333333333333'
      and role = 'owner'
      and status = 'active'
  ),
  1,
  'co-owner membership remains after the other owner is finalized'
);

-- Ownership race: co-owner added after planning prevents candidate deletion.
select public.service_plan_account_deletion(
  'a5555555-5555-4555-8555-555555555555',
  'a0000000-0000-4000-8000-000000000004'
);

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'a0000000-0000-4000-8000-000000000004',
  'a6666666-6666-4666-8666-666666666666',
  'owner',
  'active'
);

delete from auth.users
where id = 'a5555555-5555-4555-8555-555555555555';

select is(
  (
    public.service_finalize_account_deletion(
      (
        select id
        from private.account_deletion_audit
        where planned_user_id = 'a5555555-5555-4555-8555-555555555555'
        order by created_at desc
        limit 1
      ),
      'auth_deletion_completed'
    )->>'restaurants_deleted'
  )::integer,
  0,
  'a co-owner added after planning prevents restaurant deletion'
);

select is(
  (
    select count(*)::integer
    from public.restaurants
    where id = 'a0000000-0000-4000-8000-000000000004'
  ),
  1,
  'restaurant remains when ownership changed between plan and finalize'
);

-- Service-retryable cleanup failure path: a tenant_cleanup_failed audit for an
-- already-cleaned planned user can be retried to tenant_cleanup_completed.
insert into private.account_deletion_audit (
  id,
  actor_user_id,
  planned_user_id,
  requesting_restaurant_id,
  planned_deleted_restaurant_ids,
  metadata
) values (
  'a0000000-0000-4000-8000-000000000099',
  null,
  'a1111111-1111-4111-8111-111111111111',
  'a0000000-0000-4000-8000-000000000001',
  '{}'::uuid[],
  '{"phase":"tenant_cleanup_failed"}'::jsonb
);

select ok(
  (
    select
      (public.service_finalize_account_deletion(
        'a0000000-0000-4000-8000-000000000099',
        'auth_deletion_completed'
      )->>'phase') = 'tenant_cleanup_completed'
  ),
  'tenant_cleanup_failed audits are service-retryable to tenant_cleanup_completed'
);

select * from finish();
rollback;
