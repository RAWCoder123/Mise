begin;

select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'b1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'deletion-planner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'deletion-new-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.users (id, email, name, role, restaurant_id)
values
  ('b1111111-1111-4111-8111-111111111111', 'deletion-planner@mise.test', 'Planner', 'owner', null),
  ('b2222222-2222-4222-8222-222222222222', 'deletion-new-owner@mise.test', 'New Owner', 'owner', null);

insert into public.restaurants (id, name, cuisine_type)
values ('b0000000-0000-4000-8000-000000000001', 'Ownership Race Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'b0000000-0000-4000-8000-000000000001',
  'b1111111-1111-4111-8111-111111111111',
  'owner',
  'active'
);

select is(
  (
    public.service_plan_account_deletion(
      'b1111111-1111-4111-8111-111111111111',
      'b0000000-0000-4000-8000-000000000001'
    )->'owner_restaurant_candidates'->>0
  ),
  'b0000000-0000-4000-8000-000000000001',
  'planning retains every active owner-restaurant candidate'
);

select throws_ok(
  format(
    'select public.service_finalize_account_deletion(%L::uuid, %L)',
    (
      select id
      from private.account_deletion_audit
      where planned_user_id = 'b1111111-1111-4111-8111-111111111111'
      order by created_at desc
      limit 1
    ),
    'auth_deletion_completed'
  ),
  '55000',
  'Auth user must be deleted before tenant cleanup',
  'tenant cleanup cannot run before Auth deletion'
);

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'b0000000-0000-4000-8000-000000000001',
  'b2222222-2222-4222-8222-222222222222',
  'owner',
  'active'
);

delete from auth.users
where id = 'b1111111-1111-4111-8111-111111111111';

select is(
  (
    public.service_finalize_account_deletion(
      (
        select id
        from private.account_deletion_audit
        where planned_user_id = 'b1111111-1111-4111-8111-111111111111'
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
    where id = 'b0000000-0000-4000-8000-000000000001'
  ),
  1,
  'the restaurant remains after ownership changed between plan and finalize'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_memberships
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and user_id = 'b2222222-2222-4222-8222-222222222222'
      and role = 'owner'
      and status = 'active'
  ),
  1,
  'the remaining active owner retains access'
);

select * from finish();
rollback;
