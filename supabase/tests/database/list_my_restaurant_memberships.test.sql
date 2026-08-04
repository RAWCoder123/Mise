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
  (
    '51515151-5151-4151-8151-515151515151',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member-list-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '52525252-5252-4252-8252-525252525252',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member-list-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type, archived_at)
values
  ('61616161-6161-4161-8161-616161616161', 'Live Kitchen', 'Cafe', null),
  ('62626262-6262-4262-8262-626262626262', 'Archived Kitchen', 'Bar', now()),
  ('63636363-6363-4363-8363-636363636363', 'Sibling Kitchen', 'Cafe', null);

insert into public.users (id, name, email, role)
values
  ('51515151-5151-4151-8151-515151515151', 'Member List A', 'member-list-a@mise.test', 'owner'),
  ('52525252-5252-4252-8252-525252525252', 'Member List B', 'member-list-b@mise.test', 'manager');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('61616161-6161-4161-8161-616161616161', '51515151-5151-4151-8151-515151515151', 'owner', 'active'),
  ('62626262-6262-4262-8262-626262626262', '51515151-5151-4151-8151-515151515151', 'owner', 'active'),
  ('63636363-6363-4363-8363-636363636363', '52525252-5252-4252-8252-525252525252', 'owner', 'active'),
  ('61616161-6161-4161-8161-616161616161', '52525252-5252-4252-8252-525252525252', 'manager', 'disabled');

select is(
  has_function_privilege('authenticated', 'public.list_my_restaurant_memberships()', 'EXECUTE'),
  true,
  'authenticated operators can execute the identity-free membership list RPC'
);
select is(
  has_function_privilege('anon', 'public.list_my_restaurant_memberships()', 'EXECUTE'),
  false,
  'anon cannot execute the membership list RPC'
);
select is(
  (select pronargs from pg_proc where oid = 'public.list_my_restaurant_memberships()'::regprocedure),
  0::smallint,
  'membership list RPC accepts no caller-selected identity'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51515151-5151-4151-8151-515151515151', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.list_my_restaurant_memberships()),
  1,
  'operator A sees only active memberships on non-archived restaurants'
);
select is(
  (select restaurant_id::text from public.list_my_restaurant_memberships()),
  '61616161-6161-4161-8161-616161616161',
  'operator A membership list returns the live kitchen only'
);
select is(
  (select count(*)::integer
   from public.list_my_restaurant_memberships() membership
   where membership.restaurant_id = '62626262-6262-4262-8262-626262626262'),
  0,
  'archived restaurant memberships are excluded from the list'
);
select is(
  (select count(*)::integer
   from public.list_my_restaurant_memberships() membership
   where membership.user_id = '52525252-5252-4252-8252-525252525252'),
  0,
  'operator A cannot read operator B memberships through the identity-free RPC'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '52525252-5252-4252-8252-525252525252', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.list_my_restaurant_memberships()),
  1,
  'operator B sees only their own active membership'
);
select is(
  (select restaurant_id::text from public.list_my_restaurant_memberships()),
  '63636363-6363-4363-8363-636363636363',
  'operator B membership list returns their live sibling kitchen'
);
select is(
  (select count(*)::integer
   from public.list_my_restaurant_memberships() membership
   where membership.status = 'disabled'),
  0,
  'disabled memberships are excluded from the active list'
);

reset role;

select is(
  pg_temp.try_execute($sql$select * from public.list_my_restaurant_memberships()$sql$),
  false,
  'unauthenticated callers cannot list memberships'
);

select * from finish();
rollback;
