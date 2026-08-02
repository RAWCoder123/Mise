begin;

select plan(20);

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
    'authenticated', 'authenticated', 'notify-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '40404040-4040-4040-8040-404040404040',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'notify-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.users (id, name, email, role)
values
  ('30303030-3030-4030-8030-303030303030', 'Notify Operator A', 'notify-a@mise.test', 'staff'),
  ('40404040-4040-4040-8040-404040404040', 'Notify Operator B', 'notify-b@mise.test', 'manager');

select is(
  has_function_privilege('authenticated', 'public.get_my_notification_preferences()', 'EXECUTE'),
  true,
  'authenticated operators can execute the identity-free notification preference read RPC'
);
select is(
  has_function_privilege('authenticated', 'public.update_my_notification_preferences(jsonb)', 'EXECUTE'),
  false,
  'authenticated clients cannot execute the legacy notification preference mutator'
);
select is(
  has_function_privilege('authenticated', 'public.service_update_my_notification_preferences(uuid,jsonb)', 'EXECUTE'),
  false,
  'authenticated clients cannot execute the service notification preference mutator'
);
select is(
  has_function_privilege('service_role', 'public.service_update_my_notification_preferences(uuid,jsonb)', 'EXECUTE'),
  true,
  'service_role can execute the service notification preference mutator'
);
select is(
  has_column_privilege('authenticated', 'public.users', 'notification_preferences', 'UPDATE'),
  false,
  'authenticated clients cannot update notification_preferences directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30303030-3030-4030-8030-303030303030', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_notification_preferences() ->> 'inventory',
  'true',
  'operator A reads default inventory attention through auth.uid()'
);
reset role;

set local role service_role;
select is(
  public.service_update_my_notification_preferences(
    '30303030-3030-4030-8030-303030303030',
    '{"inventory":false,"orders":true,"waste":true,"recipes_pos":true,"insights":false,"setup":true}'::jsonb
  ) ->> 'inventory',
  'false',
  'service-owned preference update writes only the Edge actor profile'
);
select is(
  pg_temp.try_execute(
    $sql$select public.service_update_my_notification_preferences(
      '30303030-3030-4030-8030-303030303030',
      '{"inventory":true,"mystery":true}'::jsonb
    )$sql$
  ),
  false,
  'unsupported preference keys are denied'
);
select is(
  pg_temp.try_execute(
    $sql$select public.service_update_my_notification_preferences(
      '30303030-3030-4030-8030-303030303030',
      '{"inventory":"yes"}'::jsonb
    )$sql$
  ),
  false,
  'non-boolean preference values are denied'
);
reset role;

select is(
  (select notification_preferences ->> 'inventory' from public.users where id = '30303030-3030-4030-8030-303030303030'),
  'false',
  'operator A preference update persists on operator A only'
);
select is(
  (select notification_preferences ->> 'insights' from public.users where id = '30303030-3030-4030-8030-303030303030'),
  'false',
  'invalid preference denial leaves muted insights unchanged'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30303030-3030-4030-8030-303030303030', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$select public.update_my_notification_preferences('{"inventory":true}'::jsonb)$sql$),
  false,
  'authenticated clients cannot execute the legacy notification preference update RPC'
);
select is(
  pg_temp.try_execute(
    $sql$update public.users set notification_preferences = '{"inventory":true}'::jsonb
      where id = '30303030-3030-4030-8030-303030303030'$sql$
  ),
  false,
  'authenticated direct notification_preferences UPDATE is denied'
);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select is(
  pg_temp.try_execute($sql$select public.get_my_notification_preferences()$sql$),
  false,
  'unauthenticated callers cannot read operator notification preferences'
);
select is(
  pg_temp.try_execute($sql$select public.update_my_notification_preferences('{"inventory":true}'::jsonb)$sql$),
  false,
  'unauthenticated callers cannot update operator notification preferences'
);
reset role;

set local role service_role;
select is(
  public.service_update_my_notification_preferences(
    '40404040-4040-4040-8040-404040404040',
    '{"inventory":true,"orders":false,"waste":true,"recipes_pos":true,"insights":true,"setup":true}'::jsonb
  ) ->> 'orders',
  'false',
  'operator B update remains bound to the Edge actor profile'
);
reset role;

select is(
  (select notification_preferences ->> 'orders' from public.users where id = '40404040-4040-4040-8040-404040404040'),
  'false',
  'operator B preference update persists on operator B'
);
select is(
  (select notification_preferences ->> 'inventory' from public.users where id = '30303030-3030-4030-8030-303030303030'),
  'false',
  'operator switch cannot mutate operator A preferences through the service RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30303030-3030-4030-8030-303030303030', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_notification_preferences() ->> 'insights',
  'false',
  'identity-free read returns the actor muted insights preference'
);
select is(
  (select count(*)::int from jsonb_object_keys(public.get_my_notification_preferences())),
  6,
  'identity-free read returns exactly the six allowlisted categories'
);
reset role;

select * from finish();
rollback;
