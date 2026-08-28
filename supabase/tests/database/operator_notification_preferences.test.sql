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
  true,
  'authenticated operators can execute the identity-free notification preference update RPC'
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
select is(
  public.update_my_notification_preferences(
    '{"inventory":false,"orders":true,"deliveries":true,"waste":true,"recipes_pos":true,"insights":false,"setup":true}'::jsonb
  ) ->> 'inventory',
  'false',
  'operator A can mute inventory attention for their own profile'
);
select is(
  public.get_my_notification_preferences() ->> 'insights',
  'false',
  'operator A reads the muted insights preference after update'
);
select is(
  pg_temp.try_execute(
    $sql$select public.update_my_notification_preferences(
      '{"inventory":true,"mystery":true}'::jsonb
    )$sql$
  ),
  false,
  'unsupported preference keys are denied'
);
select is(
  pg_temp.try_execute(
    $sql$select public.update_my_notification_preferences(
      '{"inventory":"yes"}'::jsonb
    )$sql$
  ),
  false,
  'non-boolean preference values are denied'
);
select is(
  (
    select notification_preferences ->> 'inventory'
    from public.users
    where id = '30303030-3030-4030-8030-303030303030'
  ),
  'false',
  'failed unsupported updates do not rewrite the prior allowlisted preferences'
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

set local role authenticated;
select set_config('request.jwt.claim.sub', '40404040-4040-4040-8040-404040404040', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.get_my_notification_preferences() ->> 'inventory',
  'true',
  'operator B still sees defaults and cannot observe operator A muted state'
);
select is(
  public.update_my_notification_preferences(
    '{"inventory":true,"orders":false,"deliveries":true,"waste":true,"recipes_pos":true,"insights":true,"setup":true}'::jsonb
  ) ->> 'orders',
  'false',
  'operator B can mute orders independently'
);
select is(
  public.update_my_notification_preferences(
    '{"inventory":true,"orders":false,"deliveries":false,"waste":true,"recipes_pos":true,"insights":true,"setup":true}'::jsonb
  ) ->> 'deliveries',
  'false',
  'operator B can mute deliveries independently from purchasing'
);
reset role;

select is(
  (
    select notification_preferences ->> 'inventory'
    from public.users
    where id = '30303030-3030-4030-8030-303030303030'
  ),
  'false',
  'operator A inventory mute remains after operator B update'
);
select is(
  (
    select notification_preferences ->> 'orders'
    from public.users
    where id = '40404040-4040-4040-8040-404040404040'
  ),
  'false',
  'operator B orders mute is isolated to their profile'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30303030-3030-4030-8030-303030303030', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.update_my_notification_preferences(
    '{"inventory":true,"orders":true,"deliveries":true,"waste":true,"recipes_pos":true,"insights":true,"setup":true}'::jsonb
  ) ->> 'inventory',
  'true',
  'operator A can restore all attention categories'
);
select is(
  public.get_my_notification_preferences() ->> 'insights',
  'true',
  'operator A restored insights attention'
);
select is(
  public.get_my_notification_preferences() ->> 'deliveries',
  'true',
  'normalize fills deliveries as enabled for restored profiles'
);
reset role;

select * from finish();
rollback;
