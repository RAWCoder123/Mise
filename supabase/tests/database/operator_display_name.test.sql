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
    '30303030-3030-4030-8030-303030303030',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'display-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '40404040-4040-4040-8040-404040404040',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'display-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.users (id, name, email, role)
values
  ('30303030-3030-4030-8030-303030303030', 'Display Operator A', 'display-a@mise.test', 'staff'),
  ('40404040-4040-4040-8040-404040404040', 'Display Operator B', 'display-b@mise.test', 'manager');

select is(
  has_function_privilege('authenticated', 'public.get_my_display_name()', 'EXECUTE'),
  true,
  'authenticated operators can execute the identity-free display-name read RPC'
);
select is(
  has_function_privilege('authenticated', 'public.service_update_my_profile(uuid,text)', 'EXECUTE'),
  false,
  'authenticated clients cannot execute the operator profile service RPC'
);
select is(
  has_function_privilege('service_role', 'public.service_update_my_profile(uuid,text)', 'EXECUTE'),
  true,
  'service role can execute the operator profile service RPC'
);
select is(
  (select pronargs from pg_proc where oid = 'public.get_my_display_name()'::regprocedure),
  0::smallint,
  'display-name read RPC accepts no caller-selected identity'
);
select is(
  has_column_privilege('authenticated', 'public.users', 'name', 'UPDATE'),
  false,
  'authenticated clients cannot update users.name directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30303030-3030-4030-8030-303030303030', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_display_name(),
  'Display Operator A',
  'operator A reads only their current display name through auth.uid()'
);
reset role;

set local role service_role;
select lives_ok(
  $sql$select public.service_update_my_profile('30303030-3030-4030-8030-303030303030', 'Maya Chen')$sql$,
  'service-owned profile RPC updates the Edge actor display name'
);
reset role;

select is(
  (select name from public.users where id = '30303030-3030-4030-8030-303030303030'),
  'Maya Chen',
  'operator A display-name update persists on operator A only'
);
select is(
  (select name from public.users where id = '40404040-4040-4040-8040-404040404040'),
  'Display Operator B',
  'operator B display name is unchanged by operator A update'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30303030-3030-4030-8030-303030303030', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_display_name(),
  'Maya Chen',
  'operator A reads the updated display name'
);
select is(
  pg_temp.try_execute($sql$select public.service_update_my_profile('40404040-4040-4040-8040-404040404040', 'Hijack')$sql$),
  false,
  'authenticated clients cannot call the service-owned profile mutator'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40404040-4040-4040-8040-404040404040', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_display_name(),
  'Display Operator B',
  'operator B still reads only their own display name'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30303030-3030-4030-8030-303030303030', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$update public.users set name = 'Direct Write' where id = auth.uid()$sql$),
  false,
  'authenticated clients cannot update display names through direct table DML'
);
reset role;

select * from finish();
rollback;
