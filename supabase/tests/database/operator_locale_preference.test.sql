begin;

select plan(25);

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
    '10101010-1010-4010-8010-101010101010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'locale-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '20202020-2020-4020-8020-202020202020',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'locale-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.users (id, name, email, role, preferred_locale)
values
  ('10101010-1010-4010-8010-101010101010', 'Locale Operator A', 'locale-a@mise.test', 'staff', 'en'),
  ('20202020-2020-4020-8020-202020202020', 'Locale Operator B', 'locale-b@mise.test', 'manager', 'zh-Hans');

select is(
  has_function_privilege('authenticated', 'public.get_my_preferred_locale()', 'EXECUTE'),
  true,
  'authenticated operators can execute the identity-free locale read RPC'
);
select is(
  has_function_privilege('authenticated', 'public.update_my_preferred_locale(text)', 'EXECUTE'),
  false,
  'authenticated clients cannot execute the legacy locale update RPC'
);
select is(
  has_function_privilege('authenticated', 'public.service_update_my_preferred_locale(uuid,text)', 'EXECUTE'),
  false,
  'authenticated clients cannot execute the locale update service RPC'
);
select is(
  has_function_privilege('service_role', 'public.service_update_my_preferred_locale(uuid,text)', 'EXECUTE'),
  true,
  'service role can execute the locale update service RPC'
);
select is(
  (select pronargs from pg_proc where oid = 'public.get_my_preferred_locale()'::regprocedure),
  0::smallint,
  'locale read RPC accepts no caller-selected identity'
);
select is(
  (select pronargs from pg_proc where oid = 'public.update_my_preferred_locale(text)'::regprocedure),
  1::smallint,
  'locale update RPC accepts only the locale value'
);
select is(
  has_column_privilege('authenticated', 'public.users', 'preferred_locale', 'UPDATE'),
  false,
  'authenticated clients cannot update preferred_locale directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_preferred_locale(),
  'en',
  'operator A reads only their current locale through auth.uid()'
);
reset role;
set local role service_role;
select is(
  public.service_update_my_preferred_locale('10101010-1010-4010-8010-101010101010', 'es'),
  'es',
  'service-owned locale update writes only the Edge actor profile'
);
reset role;

select is(
  (select preferred_locale from public.users where id = '10101010-1010-4010-8010-101010101010'),
  'es',
  'operator A locale update persists on operator A only'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_update_my_preferred_locale('10101010-1010-4010-8010-101010101010', 'fr')$sql$),
  false,
  'unsupported locale updates are denied'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select is(
  pg_temp.try_execute($sql$select public.update_my_preferred_locale('en')$sql$),
  false,
  'authenticated clients cannot execute the legacy locale update RPC'
);
reset role;
select is(
  (select preferred_locale from public.users where id = '10101010-1010-4010-8010-101010101010'),
  'es',
  'invalid locale denial leaves the profile unchanged'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select is(
  pg_temp.try_execute($sql$select public.get_my_preferred_locale()$sql$),
  false,
  'unauthenticated callers cannot read an operator locale'
);
select is(
  pg_temp.try_execute($sql$select public.update_my_preferred_locale('en')$sql$),
  false,
  'unauthenticated callers cannot update an operator locale'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10101010-1010-4010-8010-101010101010', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute(
    $sql$update public.users set preferred_locale = 'zh-Hans'
      where id = '10101010-1010-4010-8010-101010101010'$sql$
  ),
  false,
  'authenticated direct preferred_locale UPDATE is denied'
);
select is(
  (select count(*) from public.users),
  1::bigint,
  'operator A can read only their own profile row'
);
select is(
  (select count(*) from public.users where id = '20202020-2020-4020-8020-202020202020'),
  0::bigint,
  'operator A cannot read operator B profile metadata'
);
reset role;
select is(
  (select preferred_locale from public.users where id = '10101010-1010-4010-8010-101010101010'),
  'es',
  'direct update denial leaves operator A locale unchanged'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20202020-2020-4020-8020-202020202020', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_preferred_locale(),
  'zh-Hans',
  'switching users reads operator B locale rather than stale operator A data'
);
select is(
  (select count(*) from public.users),
  1::bigint,
  'operator B can read only their own profile row'
);
select is(
  (select count(*) from public.users where id = '10101010-1010-4010-8010-101010101010'),
  0::bigint,
  'operator B cannot read operator A profile metadata'
);
reset role;
set local role service_role;
select is(
  public.service_update_my_preferred_locale('20202020-2020-4020-8020-202020202020', 'en'),
  'en',
  'operator B update remains bound to the Edge actor profile'
);
reset role;

select is(
  (select preferred_locale from public.users where id = '20202020-2020-4020-8020-202020202020'),
  'en',
  'operator B locale update persists on operator B'
);
select is(
  (select preferred_locale from public.users where id = '10101010-1010-4010-8010-101010101010'),
  'es',
  'operator switch cannot mutate operator A locale through the identity-free RPC'
);

select * from finish();
rollback;
