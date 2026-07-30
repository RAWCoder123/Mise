begin;

select plan(18);

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
    '71717171-7171-4711-8711-717171717171',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'team-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '72727272-7272-4722-8722-727272727272',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'team-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '73737373-7373-4733-8733-737373737373',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'team-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '74747474-7474-4744-8744-747474747474',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'team-join@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '75757575-7575-4755-8755-757575757575',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'team-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'Team Kitchen A', 'Fast casual'),
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'Team Kitchen B', 'Cafe');

insert into public.users (id, restaurant_id, name, email, role)
values
  ('71717171-7171-4711-8711-717171717171', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'Team Owner', 'team-owner@mise.test', 'owner'),
  ('72727272-7272-4722-8722-727272727272', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'Team Manager', 'team-manager@mise.test', 'manager'),
  ('73737373-7373-4733-8733-737373737373', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'Team Staff', 'team-staff@mise.test', 'staff'),
  ('75757575-7575-4755-8755-757575757575', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'Team Owner B', 'team-owner-b@mise.test', 'owner');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', '71717171-7171-4711-8711-717171717171', 'owner', 'active'),
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', '72727272-7272-4722-8722-727272727272', 'manager', 'active'),
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', '73737373-7373-4733-8733-737373737373', 'staff', 'active'),
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', '75757575-7575-4755-8755-757575757575', 'owner', 'active');

select is(
  has_function_privilege('authenticated', 'public.list_restaurant_members(uuid)', 'execute'),
  true,
  'authenticated users can execute list_restaurant_members'
);
select is(
  has_function_privilege('anon', 'public.list_restaurant_members(uuid)', 'execute'),
  false,
  'anon cannot execute list_restaurant_members'
);
select is(
  has_function_privilege('authenticated', 'public.add_restaurant_member_by_email(uuid,text,text)', 'execute'),
  true,
  'authenticated users can execute add_restaurant_member_by_email'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71717171-7171-4711-8711-717171717171', true);
select is(
  (select count(*)::integer from public.list_restaurant_members('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1')),
  3,
  'owner can list restaurant members'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '72727272-7272-4722-8722-727272727272', true);
select is(
  (select count(*)::integer from public.list_restaurant_members('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1')),
  3,
  'manager can list restaurant members'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '73737373-7373-4733-8733-737373737373', true);
select is(
  pg_temp.try_execute($sql$select * from public.list_restaurant_members('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1')$sql$),
  false,
  'staff cannot list restaurant members'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '75757575-7575-4755-8755-757575757575', true);
select is(
  pg_temp.try_execute($sql$select * from public.list_restaurant_members('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1')$sql$),
  false,
  'cross-tenant owner cannot list another restaurant roster'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71717171-7171-4711-8711-717171717171', true);
select lives_ok(
  $sql$select public.add_restaurant_member_by_email(
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    'team-join@mise.test',
    'staff'
  )$sql$,
  'owner can add an existing auth user by email'
);
reset role;

select is(
  (
    select count(*)
    from public.restaurant_memberships
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and user_id = '74747474-7474-4744-8744-747474747474'
      and role = 'staff'
      and status = 'active'
  ),
  1::bigint,
  'email-added membership persisted'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and action = 'restaurant_member_added'
  ),
  1::bigint,
  'member add writes an audit log'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '72727272-7272-4722-8722-727272727272', true);
select is(
  pg_temp.try_execute($sql$select public.add_restaurant_member_by_email(
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    'team-owner-b@mise.test',
    'staff'
  )$sql$),
  false,
  'manager cannot add members by email'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71717171-7171-4711-8711-717171717171', true);
select lives_ok(
  $sql$select public.update_restaurant_member(
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    '74747474-7474-4744-8744-747474747474',
    'manager',
    null
  )$sql$,
  'owner can update an added member role'
);
reset role;

select is(
  (
    select role
    from public.restaurant_memberships
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and user_id = '74747474-7474-4744-8744-747474747474'
  ),
  'manager',
  'role update persisted'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and action = 'restaurant_member_updated'
  ),
  1::bigint,
  'member update writes an audit log'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71717171-7171-4711-8711-717171717171', true);
select lives_ok(
  $sql$select public.remove_restaurant_member(
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    '74747474-7474-4744-8744-747474747474'
  )$sql$,
  'owner can remove an added member'
);
reset role;

select is(
  (
    select count(*)
    from public.restaurant_memberships
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and user_id = '74747474-7474-4744-8744-747474747474'
  ),
  0::bigint,
  'removed membership no longer exists'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and action = 'restaurant_member_removed'
  ),
  1::bigint,
  'member removal writes an audit log'
);

select * from finish();
rollback;
