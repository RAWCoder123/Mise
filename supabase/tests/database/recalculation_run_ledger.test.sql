begin;

select plan(15);

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

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'a1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'recalc-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'recalc-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'recalc-outsider@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type, timezone)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'Recalculation Kitchen',
    'Fast casual',
    'America/New_York'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'Neighbouring Kitchen',
    'Bistro',
    'America/New_York'
  );

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'a1111111-1111-4111-8111-111111111111',
    'owner',
    'active'
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'a2222222-2222-4222-8222-222222222222',
    'staff',
    'active'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'a3333333-3333-4333-8333-333333333333',
    'owner',
    'active'
  );

-- Schema authority ---------------------------------------------------------

select is(
  (select relrowsecurity from pg_class where oid = 'public.recalculation_runs'::regclass),
  true,
  'the recalculation run ledger enforces row level security'
);

select is(
  has_table_privilege('anon', 'public.recalculation_runs', 'SELECT'),
  false,
  'anonymous callers cannot read the recalculation run ledger'
);

select is(
  has_table_privilege('authenticated', 'public.recalculation_runs', 'INSERT'),
  false,
  'members cannot insert recalculation runs directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.record_recalculation_run(uuid, text, date, text, smallint, text, text, timestamptz, timestamptz, integer, boolean, text, text, text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot record recalculation runs'
);

-- Recording, replay, and authority ----------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_recalculation_run(
    'a0000000-0000-4000-8000-000000000001',
    'daily_open', '2026-08-05', 'succeeded', 1::smallint,
    'recalculation.daily_open', 'manager',
    '2026-08-05T09:30:00Z', '2026-08-05T09:30:04Z', 4000, false, null,
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:daily_open',
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:daily_open:attempt-1'
  )).id is not null,
  'any active member may record a mechanical recalculation run'
);

select is(
  (
    select count(*)
    from public.recalculation_runs
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'an identical replay of the attempt key records no duplicate row'
);

select is(
  pg_temp.try_execute($replay$
    select public.record_recalculation_run(
      'a0000000-0000-4000-8000-000000000001',
      'daily_open', '2026-08-05', 'failed', 1::smallint,
      'recalculation.daily_open', 'manager',
      '2026-08-05T09:30:00Z', '2026-08-05T09:30:04Z', 4000, false, 'Different payload',
      'recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:daily_open',
      'recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:daily_open:attempt-1'
    );
  $replay$),
  false,
  'a reused attempt key carrying a different payload is rejected'
);

select is(
  pg_temp.try_execute($direct$
    insert into public.recalculation_runs (
      restaurant_id, cycle, operating_date, status, attempt, job_name,
      monitoring_owner, started_at, completed_at, duration_ms, timed_out,
      cycle_key, idempotency_key, recorded_by
    ) values (
      'a0000000-0000-4000-8000-000000000001',
      'close', '2026-08-05', 'succeeded', 1, 'recalculation.close', 'owner_admin',
      now(), now(), 10, false, 'forged', 'forged:attempt-1',
      'a2222222-2222-4222-8222-222222222222'
    );
  $direct$),
  false,
  'a member cannot bypass the RPC with a direct ledger insert'
);

-- Activity projection ------------------------------------------------------

select ok(
  (public.record_recalculation_run(
    'a0000000-0000-4000-8000-000000000001',
    'close', '2026-08-05', 'failed', 4::smallint,
    'recalculation.close', 'owner_admin',
    '2026-08-05T22:00:00Z', '2026-08-05T22:03:00Z', 180000, true,
    'Supplier confirmation endpoint returned 503',
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:close',
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-05:close:attempt-4'
  )).id is not null,
  'a dead-lettered attempt is recorded'
);

select is(
  (
    select requires_attention
    from public.activity_events
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and event_type = 'automation_failed'
      and sequence_id = 'recalculation:2026-08-05:close'
  ),
  true,
  'the dead-lettered attempt raises an activity event that demands a human'
);

select ok(
  (public.record_recalculation_run(
    'a0000000-0000-4000-8000-000000000001',
    'close', '2026-08-06', 'succeeded', 1::smallint,
    'recalculation.close', 'owner_admin',
    '2026-08-06T22:00:00Z', '2026-08-06T22:02:00Z', 120000, false, null,
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-06:close',
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-06:close:attempt-1'
  )).id is not null,
  'a close success is recorded'
);

select is(
  (
    select title
    from public.activity_events
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and event_type = 'forecast_updated'
      and sequence_id = 'recalculation:2026-08-06:close'
  ),
  'Closing reconciliation completed',
  'close success projects a reconciliation activity beat'
);

select ok(
  (public.record_recalculation_run(
    'a0000000-0000-4000-8000-000000000001',
    'mid_shift', '2026-08-06', 'succeeded', 1::smallint,
    'recalculation.mid_shift', 'manager',
    '2026-08-06T15:00:00Z', '2026-08-06T15:01:00Z', 60000, false, null,
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-06:mid_shift',
    'recalc:a0000000-0000-4000-8000-000000000001:2026-08-06:mid_shift:attempt-1'
  )).id is not null,
  'a mid_shift success is recorded'
);

select is(
  (
    select count(*)::integer
    from public.activity_events
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and sequence_id = 'recalculation:2026-08-06:mid_shift'
  ),
  0,
  'mid_shift success stays ledger-only'
);

-- Tenant isolation ---------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3333333-3333-4333-8333-333333333333', true);

select is(
  (select count(*) from public.recalculation_runs),
  0::bigint,
  'a neighbouring restaurant owner cannot read this ledger'
);

reset role;

select * from finish();

rollback;
