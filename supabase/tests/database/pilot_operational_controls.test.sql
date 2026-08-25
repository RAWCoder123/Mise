begin;

select plan(40);

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

select has_table(
  'private',
  'pilot_operational_control_changes',
  'pilot control changes have a durable private ledger'
);
select is(
  has_function_privilege(
    'service_role',
    'public.service_apply_pilot_operational_control(uuid,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  true,
  'service role can apply an atomic pilot control'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_apply_pilot_operational_control(uuid,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot apply pilot controls'
);
select is(
  has_table_privilege('authenticated', 'private.pilot_operational_control_changes', 'SELECT'),
  false,
  'authenticated clients cannot read private pilot control history'
);
select is(
  has_table_privilege('service_role', 'private.pilot_operational_control_changes', 'SELECT'),
  true,
  'service role can inspect pilot control incident evidence'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    'e1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pilot-owner-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'e2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pilot-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-000000000001', 'Pilot Control A', 'Cafe', 'UTC'),
  ('e0000000-0000-4000-8000-000000000002', 'Pilot Control B', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('e0000000-0000-4000-8000-000000000002', 'e2222222-2222-4222-8222-222222222222', 'owner', 'active');

insert into public.pos_integrations (id, restaurant_id, provider, status) values
  ('e0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', 'square', 'connected'),
  ('e0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000002', 'square', 'connected');

insert into public.pos_locations (
  id, restaurant_id, pos_integration_id, external_location_id,
  display_name, timezone, status
) values
  (
    'e0000000-0000-4000-8000-000000000021',
    'e0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000011',
    'pilot-control-a', 'Pilot A', 'UTC', 'active'
  ),
  (
    'e0000000-0000-4000-8000-000000000022',
    'e0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000012',
    'pilot-control-b', 'Pilot B', 'UTC', 'active'
  );

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000031', 'e0000000-0000-4000-8000-000000000001', 'Pilot Supplier A', 'pilot supplier a'),
  ('e0000000-0000-4000-8000-000000000032', 'e0000000-0000-4000-8000-000000000002', 'Pilot Supplier B', 'pilot supplier b');

insert into public.restaurant_email_connections (
  id, restaurant_id, provider, status, sender_email, last_verified_at
) values
  ('e0000000-0000-4000-8000-000000000041', 'e0000000-0000-4000-8000-000000000001', 'gmail', 'connected', 'pilot-a@mise.test', now()),
  ('e0000000-0000-4000-8000-000000000042', 'e0000000-0000-4000-8000-000000000002', 'gmail', 'connected', 'pilot-b@mise.test', now());

insert into public.supplier_recipients (
  id, restaurant_id, supplier_id, supplier_name, email
) values
  ('e0000000-0000-4000-8000-000000000051', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000031', 'Pilot Supplier A', 'recipient-a@mise.test'),
  ('e0000000-0000-4000-8000-000000000052', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000032', 'Pilot Supplier B', 'recipient-b@mise.test');

update public.system_operational_controls
set operational_mode = 'normal',
    square_sync_enabled = false,
    square_webhooks_enabled = false,
    gmail_delivery_enabled = false,
    ordering_policy = 'off',
    order_drafting_enabled = false,
    updated_by = null
where singleton;
update public.restaurant_operational_controls
set square_sync_enabled = false,
    square_webhooks_enabled = false,
    gmail_delivery_enabled = false,
    ordering_policy = 'off',
    order_drafting_enabled = false,
    updated_by = null
where restaurant_id in (
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000002'
);

select is(
  public.service_apply_pilot_operational_control(
    'e0000000-0000-4000-8000-000000000101',
    'e0000000-0000-4000-8000-000000000001',
    'enable-square-sync',
    'e1111111-1111-4111-8111-111111111111',
    'pgtap_square_enable'
  )->>'outcome',
  'applied',
  'Square enablement applies atomically'
);
select is((select square_sync_enabled from public.system_operational_controls where singleton), true, 'atomic enable opens the system Square gate');
select is((select square_sync_enabled from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000001'), true, 'atomic enable opens the target Square gate');
select is((select updated_by from public.system_operational_controls where singleton), 'e1111111-1111-4111-8111-111111111111'::uuid, 'system control records the human actor');
select is((select updated_by from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000001'), 'e1111111-1111-4111-8111-111111111111'::uuid, 'restaurant control records the human actor');
select is((select count(*) from private.pilot_operational_control_changes where request_id = 'e0000000-0000-4000-8000-000000000101'), 1::bigint, 'atomic enable appends one audit row');
select is((select actor_user_id from private.pilot_operational_control_changes where request_id = 'e0000000-0000-4000-8000-000000000101'), 'e1111111-1111-4111-8111-111111111111'::uuid, 'audit row attributes the requested human actor');
select ok(
  (select (before_state #>> '{system,square_sync_enabled}')::boolean = false
       and (after_state #>> '{system,square_sync_enabled}')::boolean = true
   from private.pilot_operational_control_changes
   where request_id = 'e0000000-0000-4000-8000-000000000101'),
  'audit evidence binds safe before and after control state'
);
select is(
  (select position('@' in before_state::text || after_state::text)
   from private.pilot_operational_control_changes
   where request_id = 'e0000000-0000-4000-8000-000000000101'),
  0,
  'audit summaries contain no email addresses or provider credentials'
);
select is(
  public.service_apply_pilot_operational_control(
    'e0000000-0000-4000-8000-000000000101',
    'e0000000-0000-4000-8000-000000000001',
    'enable-square-sync',
    'e1111111-1111-4111-8111-111111111111',
    'pgtap_square_enable'
  )->>'outcome',
  'already_applied',
  'exact request replay returns immutable prior evidence'
);
select is((select count(*) from private.pilot_operational_control_changes where request_id = 'e0000000-0000-4000-8000-000000000101'), 1::bigint, 'request replay creates no duplicate audit row');
select is(
  pg_temp.try_execute($sql$
    select public.service_apply_pilot_operational_control(
      'e0000000-0000-4000-8000-000000000101',
      'e0000000-0000-4000-8000-000000000001',
      'disable-square',
      'e1111111-1111-4111-8111-111111111111',
      'pgtap_square_enable'
    )
  $sql$),
  false,
  'a changed payload cannot reuse request authority'
);

update public.system_operational_controls set square_sync_enabled = false where singleton;
update public.restaurant_operational_controls
set square_sync_enabled = case when restaurant_id = 'e0000000-0000-4000-8000-000000000002' then true else false end,
    square_webhooks_enabled = false
where restaurant_id in ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002');

select is(
  pg_temp.try_execute($sql$
    select public.service_apply_pilot_operational_control(
      'e0000000-0000-4000-8000-000000000102',
      'e0000000-0000-4000-8000-000000000001',
      'enable-square-sync',
      'e1111111-1111-4111-8111-111111111111',
      'pgtap_other_square'
    )
  $sql$),
  false,
  'an existing other-tenant Square gate blocks global widening'
);
select is((select square_sync_enabled from public.system_operational_controls where singleton), false, 'collision leaves the global Square gate off');
select is((select square_sync_enabled from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000001'), false, 'collision leaves the target Square gate off');
select is((select count(*) from private.pilot_operational_control_changes where request_id = 'e0000000-0000-4000-8000-000000000102'), 0::bigint, 'collision appends no applied audit evidence');
select is(
  pg_temp.try_execute($sql$
    select public.service_apply_pilot_operational_control(
      'e0000000-0000-4000-8000-000000000103',
      'e0000000-0000-4000-8000-000000000001',
      'enable-order-drafting',
      'e2222222-2222-4222-8222-222222222222',
      'pgtap_cross_tenant_actor'
    )
  $sql$),
  false,
  'an owner from another tenant cannot authorize target controls'
);

update public.restaurant_operational_controls
set square_sync_enabled = false
where restaurant_id = 'e0000000-0000-4000-8000-000000000002';

create function private.test_fail_pilot_control_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.reason_code = 'force_audit_failure' then
    raise exception using errcode = '55000', message = 'forced pilot audit failure';
  end if;
  return new;
end;
$$;
create trigger test_fail_pilot_control_audit
before insert on private.pilot_operational_control_changes
for each row execute function private.test_fail_pilot_control_audit();

select is(
  pg_temp.try_execute($sql$
    select public.service_apply_pilot_operational_control(
      'e0000000-0000-4000-8000-000000000104',
      'e0000000-0000-4000-8000-000000000001',
      'enable-order-drafting',
      'e1111111-1111-4111-8111-111111111111',
      'force_audit_failure'
    )
  $sql$),
  false,
  'an audit failure rejects the complete control transaction'
);
select is((select order_drafting_enabled from public.system_operational_controls where singleton), false, 'audit failure rolls back the system mutation');
select is((select order_drafting_enabled from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000001'), false, 'audit failure rolls back the restaurant mutation');
select is((select count(*) from private.pilot_operational_control_changes where request_id = 'e0000000-0000-4000-8000-000000000104'), 0::bigint, 'audit failure leaves no partial history row');

drop trigger test_fail_pilot_control_audit on private.pilot_operational_control_changes;
drop function private.test_fail_pilot_control_audit();

update public.system_operational_controls set square_sync_enabled = true where singleton;
update public.restaurant_operational_controls set square_sync_enabled = true
where restaurant_id in ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002');

select is(
  public.service_apply_pilot_operational_control(
    'e0000000-0000-4000-8000-000000000105',
    'e0000000-0000-4000-8000-000000000001',
    'disable-square',
    'e1111111-1111-4111-8111-111111111111',
    'pgtap_disable_square'
  )->>'outcome',
  'applied',
  'tenant Square disable applies through the atomic boundary'
);
select is((select square_sync_enabled from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000001'), false, 'disable closes only target Square');
select is((select square_sync_enabled from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000002'), true, 'disable leaves the other tenant unchanged');
select is((select square_sync_enabled from public.system_operational_controls where singleton), true, 'tenant disable leaves the shared system gate unchanged');
select is((select count(*) from private.pilot_operational_control_changes where request_id = 'e0000000-0000-4000-8000-000000000105' and actor_user_id = 'e1111111-1111-4111-8111-111111111111'), 1::bigint, 'disable appends one attributed audit row');

update public.system_operational_controls set gmail_delivery_enabled = false where singleton;
update public.restaurant_operational_controls set gmail_delivery_enabled = false
where restaurant_id in ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002');

select is(
  public.service_apply_pilot_operational_control(
    'e0000000-0000-4000-8000-000000000106',
    'e0000000-0000-4000-8000-000000000001',
    'enable-gmail-delivery',
    'e1111111-1111-4111-8111-111111111111',
    'pgtap_gmail_enable'
  )->>'outcome',
  'applied',
  'Gmail enablement validates database-visible connection and recipient readiness'
);
select ok(
  (select gmail_delivery_enabled from public.system_operational_controls where singleton)
  and (select gmail_delivery_enabled from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000001'),
  'Gmail system and restaurant gates commit together'
);
select is(
  pg_temp.try_execute($sql$
    select public.service_apply_pilot_operational_control(
      'e0000000-0000-4000-8000-000000000107',
      'e0000000-0000-4000-8000-000000000002',
      'enable-gmail-delivery',
      'e2222222-2222-4222-8222-222222222222',
      'pgtap_other_gmail'
    )
  $sql$),
  false,
  'a second restaurant cannot acquire an occupied pilot Gmail domain'
);
select is((select gmail_delivery_enabled from public.restaurant_operational_controls where restaurant_id = 'e0000000-0000-4000-8000-000000000002'), false, 'failed Gmail collision leaves the second tenant off');

select is(
  public.service_apply_pilot_operational_control(
    'e0000000-0000-4000-8000-000000000108',
    'e0000000-0000-4000-8000-000000000001',
    'pause-integrations',
    'e1111111-1111-4111-8111-111111111111',
    'pgtap_pause_integrations'
  ) #>> '{state,system,operational_mode}',
  'integrations_paused',
  'pilot pause uses the mature system-mode transition inside the wrapper transaction'
);
select is((select count(*) from private.operational_mode_changes where request_id = 'e0000000-0000-4000-8000-000000000108'), 1::bigint, 'pause retains mature operational-mode evidence');
select is((select count(*) from private.pilot_operational_control_changes where request_id = 'e0000000-0000-4000-8000-000000000108' and actor_user_id = 'e1111111-1111-4111-8111-111111111111'), 1::bigint, 'pause also records attributable pilot action evidence');
select is(
  public.service_apply_pilot_operational_control(
    'e0000000-0000-4000-8000-000000000109',
    'e0000000-0000-4000-8000-000000000001',
    'resume-normal',
    'e1111111-1111-4111-8111-111111111111',
    'pgtap_resume_normal'
  ) #>> '{state,system,operational_mode}',
  'normal',
  'pilot resume restores normal through the same attributed wrapper'
);
select is(
  pg_temp.try_execute($sql$
    update private.pilot_operational_control_changes
    set reason_code = 'rewritten'
    where request_id = 'e0000000-0000-4000-8000-000000000101'
  $sql$),
  false,
  'pilot action evidence is append-only'
);

select * from finish();
rollback;
