begin;

select plan(10);

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

update public.system_operational_controls
set operational_mode = 'normal', updated_at = now(), updated_by = null
where singleton;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'f1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mode-owner@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('f0000000-0000-4000-8000-000000000001', 'Mode Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'f0000000-0000-4000-8000-000000000001',
  'f1111111-1111-4111-8111-111111111111',
  'owner',
  'active'
);

insert into public.restaurant_operational_controls (restaurant_id)
values ('f0000000-0000-4000-8000-000000000001');

select is(
  has_function_privilege(
    'service_role',
    'public.service_set_system_operational_mode(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  true,
  'service role can transition system mode'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_set_system_operational_mode(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot transition system mode'
);
select is(
  has_table_privilege('authenticated', 'private.operational_mode_changes', 'SELECT'),
  false,
  'authenticated clients cannot read private mode history'
);

select is(
  (
    select duplicate
    from public.service_set_system_operational_mode(
      'f0000000-0000-4000-8000-000000000091',
      'read_only',
      'pgtap_read_only',
      'f1111111-1111-4111-8111-111111111111'
    )
  ),
  false,
  'first read-only transition is authoritative'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    update public.restaurant_operational_controls
    set gmail_delivery_enabled = false,
        updated_at = now(),
        updated_by = 'f1111111-1111-4111-8111-111111111111'
    where restaurant_id = 'f0000000-0000-4000-8000-000000000001'
  $sql$),
  false,
  'read-only mode blocks an authenticated tenant mutation'
);
reset role;

select is(
  (
    select duplicate
    from public.service_set_system_operational_mode(
      'f0000000-0000-4000-8000-000000000091',
      'read_only',
      'pgtap_read_only',
      'f1111111-1111-4111-8111-111111111111'
    )
  ),
  true,
  'an exact transition replay is deduplicated'
);
select is(
  pg_temp.try_execute($sql$
    select public.service_set_system_operational_mode(
      'f0000000-0000-4000-8000-000000000091',
      'emergency',
      'pgtap_conflict',
      'f1111111-1111-4111-8111-111111111111'
    )
  $sql$),
  false,
  'a conflicting transition replay is rejected'
);
select is(
  pg_temp.try_execute($sql$
    update private.operational_mode_changes
    set reason_code = 'rewritten'
    where request_id = 'f0000000-0000-4000-8000-000000000091'
  $sql$),
  false,
  'operational mode history is append-only'
);

select is(
  (
    select next_mode
    from public.service_set_system_operational_mode(
      'f0000000-0000-4000-8000-000000000092',
      'normal',
      'pgtap_restore_normal',
      'f1111111-1111-4111-8111-111111111111'
    )
  ),
  'normal',
  'service role can restore normal mode'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    update public.restaurant_operational_controls
    set gmail_delivery_enabled = false,
        updated_at = now(),
        updated_by = 'f1111111-1111-4111-8111-111111111111'
    where restaurant_id = 'f0000000-0000-4000-8000-000000000001'
  $sql$),
  true,
  'normal mode permits an otherwise authorized tenant mutation'
);
reset role;

select * from finish();
rollback;
