begin;

select plan(14);

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
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sole-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'co-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'Sole Owner Kitchen', 'Cafe'),
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'Shared Kitchen', 'Bar');

insert into public.users (id, restaurant_id, name, email, role)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'Sole Owner', 'sole-owner@mise.test', 'owner'),
  ('a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'Co Owner', 'co-owner@mise.test', 'owner'),
  ('a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'Staff', 'staff@mise.test', 'staff');

insert into public.restaurant_memberships (id, restaurant_id, user_id, role, status)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'owner', 'active'),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3', 'staff', 'active'),
  ('c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'owner', 'active'),
  ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', 'owner', 'active');

select is(
  has_function_privilege('authenticated', 'public.request_my_account_deletion(text)', 'execute'),
  true,
  'authenticated users can request their own account deletion'
);
select is(
  has_function_privilege('authenticated', 'public.service_rollback_failed_account_deletion(uuid)', 'execute'),
  false,
  'authenticated clients cannot execute account deletion rollback'
);
select is(
  has_function_privilege('service_role', 'public.service_rollback_failed_account_deletion(uuid)', 'execute'),
  true,
  'service role can roll back failed account deletion'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'restaurants'
      and column_name = 'archived_at'
  ),
  'restaurants expose archived_at for sole-owner shutdown'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  pg_temp.try_execute('select public.request_my_account_deletion(''DELETE'')'),
  'sole owner can request account deletion without last-owner guard failure'
);

reset role;

select is(
  (select status from public.restaurant_memberships where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'),
  'disabled',
  'sole-owner membership is disabled'
);
select is(
  (select status from public.restaurant_memberships where id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'),
  'disabled',
  'staff on sole-owned restaurant are disabled with the owner'
);
select is(
  (select status from public.restaurant_memberships where id = 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3'),
  'disabled',
  'co-owned membership for the deleting user is disabled'
);
select is(
  (select status from public.restaurant_memberships where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  'active',
  'remaining co-owner keeps active ownership'
);
select ok(
  (select archived_at is not null from public.restaurants where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  'sole-owned restaurant is archived'
);
select ok(
  (select archived_at is null from public.restaurants where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'),
  'shared restaurant is not archived'
);

select ok(
  (
    select (public.service_rollback_failed_account_deletion(id)).status = 'failed'
    from public.account_deletion_requests
    where subject_user_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
      and status in ('requested', 'processing')
    order by requested_at desc
    limit 1
  ),
  'service rollback marks the deletion request failed'
);

select is(
  (select status from public.restaurant_memberships where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'),
  'active',
  'rollback restores sole-owner membership'
);
select ok(
  (select archived_at is null from public.restaurants where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  'rollback unarchives the sole-owned restaurant'
);

select * from finish();
rollback;
