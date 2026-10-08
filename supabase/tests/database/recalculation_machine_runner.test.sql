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
exception when others then
  return false;
end;
$$;

create or replace function pg_temp.error_of(statement text)
returns text
language plpgsql
security invoker
as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'b1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'machine-runner-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'machine-runner-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type, timezone)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'Machine Runner Kitchen',
    'Fast casual',
    'America/New_York'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'No Manager Kitchen',
    'Cafe',
    'America/Chicago'
  );

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'b1111111-1111-4111-8111-111111111111',
    'owner',
    'active'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'b2222222-2222-4222-8222-222222222222',
    'staff',
    'active'
  );

select is(
  has_function_privilege(
    'authenticated',
    'public.service_record_machine_recalculation_run(uuid, text, date, text, smallint, text, text, timestamptz, timestamptz, integer, boolean, text, text, text)',
    'EXECUTE'
  ),
  false,
  'authenticated callers cannot record machine recalculation runs'
);

select is(
  has_function_privilege(
    'anon',
    'public.service_list_recalculation_runner_targets(integer)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot list recalculation runner targets'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_record_machine_recalculation_run(uuid, text, date, text, smallint, text, text, timestamptz, timestamptz, integer, boolean, text, text, text)',
    'EXECUTE'
  ),
  true,
  'service_role can record machine recalculation runs'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_resolve_recalculation_signal_actor(uuid)',
    'EXECUTE'
  ),
  true,
  'service_role can resolve recalculation signal actors'
);

set local role service_role;

select is(
  (select count(*)::integer from public.service_list_recalculation_runner_targets(25)
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'),
  1,
  'eligible restaurants with a timezone appear as runner targets'
);

select is(
  public.service_resolve_recalculation_signal_actor('b0000000-0000-4000-8000-000000000001'),
  'b1111111-1111-4111-8111-111111111111'::uuid,
  'signal actor resolution prefers an active owner'
);

select is(
  public.service_resolve_recalculation_signal_actor('b0000000-0000-4000-8000-000000000002'),
  null,
  'staff-only restaurants do not resolve a signal actor'
);

select is(
  (public.service_record_machine_recalculation_run(
    'b0000000-0000-4000-8000-000000000001',
    'daily_open', '2026-10-08', 'succeeded', 1,
    'recalculation.daily_open', 'manager',
    '2026-10-08T08:00:00Z', '2026-10-08T08:00:05Z', 5000, false, null,
    'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open',
    'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open:attempt-1'
  )).recorded_source,
  'machine',
  'machine recording stores recorded_source = machine'
);

select is(
  (select recorded_by from public.recalculation_runs
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and idempotency_key = 'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open:attempt-1'),
  null,
  'machine recording never invents a human recorded_by'
);

select is(
  (public.service_record_machine_recalculation_run(
    'b0000000-0000-4000-8000-000000000001',
    'daily_open', '2026-10-08', 'succeeded', 1,
    'recalculation.daily_open', 'manager',
    '2026-10-08T08:00:00Z', '2026-10-08T08:00:05Z', 5000, false, null,
    'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open',
    'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open:attempt-1'
  )).id,
  (select id from public.recalculation_runs
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and idempotency_key = 'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open:attempt-1'),
  'identical machine replay returns the original run'
);

select is(
  pg_temp.error_of($sql$
    select public.service_record_machine_recalculation_run(
      'b0000000-0000-4000-8000-000000000001',
      'daily_open', '2026-10-08', 'failed', 1,
      'recalculation.daily_open', 'manager',
      '2026-10-08T08:00:00Z', '2026-10-08T08:00:05Z', 5000, false, 'timeout',
      'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open',
      'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:daily_open:attempt-1'
    )
  $sql$),
  'Recalculation run idempotency key already recorded a different attempt',
  'machine recording rejects a reused key with a different payload'
);

select is(
  (select count(*)::integer from public.recalculation_runs
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'),
  1,
  'failed machine replay does not insert a second row'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'b1111111-1111-4111-8111-111111111111';
set local "request.jwt.claim.role" = 'authenticated';

select is(
  pg_temp.try_execute($sql$
    select public.service_record_machine_recalculation_run(
      'b0000000-0000-4000-8000-000000000001',
      'mid_shift', '2026-10-08', 'succeeded', 1,
      'recalculation.mid_shift', 'manager',
      '2026-10-08T14:00:00Z', '2026-10-08T14:00:05Z', 5000, false, null,
      'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:mid_shift',
      'recalc:b0000000-0000-4000-8000-000000000001:2026-10-08:mid_shift:attempt-1'
    )
  $sql$),
  false,
  'authenticated members cannot execute the machine recording RPC'
);

select is(
  (select count(*)::integer from public.recalculation_runs
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and cycle = 'mid_shift'),
  0,
  'authenticated machine-RPC attempt leaves no ledger row'
);

select * from finish();
rollback;
