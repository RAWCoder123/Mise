begin;

select plan(24);

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
    'f1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'finding-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'finding-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'f3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'finding-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('f0000000-0000-4000-8000-000000000001', 'Finding Kitchen A', 'Fast casual'),
  ('f0000000-0000-4000-8000-000000000002', 'Finding Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('f0000000-0000-4000-8000-000000000001', 'f1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('f0000000-0000-4000-8000-000000000001', 'f2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('f0000000-0000-4000-8000-000000000002', 'f3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.operational_finding_decisions (
  restaurant_id, finding_id, policy_version, decision_type,
  finding_generated_at, finding_category, severity, confidence_score,
  evidence, original_recommended_action, client_event_id, idempotency_key,
  actor_user_id
)
values (
  'f0000000-0000-4000-8000-000000000002',
  'finding:data-gap:sales:fixture',
  'beta-findings-v1',
  'dismissed',
  now(),
  'data_quality',
  'warning',
  1,
  jsonb_build_array(jsonb_build_object(
    'type', 'data_gap',
    'id', 'sales:fixture',
    'observedAt', now(),
    'summary', 'Fixture evidence'
  )),
  'Import sales.',
  'tenant-b-fixture',
  'tenant-b-fixture',
  'f3333333-3333-4333-8333-333333333333'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_operational_finding_decision(uuid,text,text,text,timestamptz,text,text,numeric,jsonb,text,text,text,text)',
    'EXECUTE'
  ),
  true,
  'authenticated operators can call the guarded finding decision RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.record_operational_finding_decision(uuid,text,text,text,timestamptz,text,text,numeric,jsonb,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot execute the finding decision RPC'
);
select is(
  has_table_privilege('authenticated', 'public.operational_finding_decisions', 'INSERT'),
  false,
  'authenticated clients cannot insert finding decisions directly'
);
select is(
  has_table_privilege('authenticated', 'public.operational_finding_decisions', 'UPDATE'),
  false,
  'authenticated clients cannot update finding decisions directly'
);
select is(
  has_table_privilege('authenticated', 'public.operational_finding_decisions', 'DELETE'),
  false,
  'authenticated clients cannot delete finding decisions directly'
);
select is(
  has_table_privilege('service_role', 'public.operational_finding_decisions', 'TRUNCATE'),
  false,
  'service role cannot truncate finding decision history'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_operational_finding_decision(
      'f0000000-0000-4000-8000-000000000001',
      'finding:data-gap:sales:staff',
      'beta-findings-v1',
      'approved',
      now(),
      'data_quality',
      'warning',
      1,
      '[{"type":"data_gap","id":"sales:staff","observedAt":"2026-07-28T12:00:00Z","summary":"Missing sales"}]'::jsonb,
      'Import sales.',
      null,
      'staff-decision',
      'staff-decision'
    )
  $sql$),
  false,
  'staff cannot record authoritative finding feedback'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_operational_finding_decision(
      'f0000000-0000-4000-8000-000000000002',
      'finding:data-gap:sales:cross-tenant',
      'beta-findings-v1',
      'approved',
      now(),
      'data_quality',
      'warning',
      1,
      '[{"type":"data_gap","id":"sales:cross","observedAt":"2026-07-28T12:00:00Z","summary":"Missing sales"}]'::jsonb,
      'Import sales.',
      null,
      'cross-tenant-decision',
      'cross-tenant-decision'
    )
  $sql$),
  false,
  'a manager cannot record feedback for another restaurant'
);
select ok(
  (public.record_operational_finding_decision(
    'f0000000-0000-4000-8000-000000000001',
    'finding:recommendation:chicken',
    'beta-findings-v1',
    'edited',
    now(),
    'ordering',
    'urgent',
    0.92,
    jsonb_build_array(jsonb_build_object(
      'type', 'inventory_item',
      'id', 'chicken',
      'observedAt', now(),
      'summary', 'Low chicken coverage'
    )),
    'Review 38 lb.',
    'Review 30 lb after recounting.',
    'manager-decision-1',
    'manager-decision-1'
  )).id is not null,
  'a manager can append scoped finding feedback'
);
select is(
  (
    public.record_operational_finding_decision(
      'f0000000-0000-4000-8000-000000000001',
      'finding:recommendation:chicken',
      'beta-findings-v1',
      'edited',
      (
        select finding_generated_at
        from public.operational_finding_decisions
        where client_event_id = 'manager-decision-1'
      ),
      'ordering',
      'urgent',
      0.92,
      (
        select evidence
        from public.operational_finding_decisions
        where client_event_id = 'manager-decision-1'
      ),
      'Review 38 lb.',
      'Review 30 lb after recounting.',
      'manager-decision-1',
      'manager-decision-1'
    )
  ).id,
  (
    select id
    from public.operational_finding_decisions
    where client_event_id = 'manager-decision-1'
  ),
  'an identical replay returns the authoritative decision'
);
select is(
  pg_temp.try_execute($sql$
    select public.record_operational_finding_decision(
      'f0000000-0000-4000-8000-000000000001',
      'finding:recommendation:chicken',
      'beta-findings-v1',
      'dismissed',
      now(),
      'ordering',
      'urgent',
      0.92,
      '[{"type":"inventory_item","id":"chicken","observedAt":"2026-07-28T12:00:00Z","summary":"Low chicken coverage"}]'::jsonb,
      'Review 38 lb.',
      null,
      'manager-decision-1',
      'manager-decision-1'
    )
  $sql$),
  false,
  'a changed replay surfaces an idempotency conflict'
);
select is(
  pg_temp.try_execute($sql$
    select public.record_operational_finding_decision(
      'f0000000-0000-4000-8000-000000000001',
      'finding:recommendation:invalid-edit',
      'beta-findings-v1',
      'edited',
      now(),
      'ordering',
      'warning',
      0.8,
      '[{"type":"inventory_item","id":"chicken","observedAt":"2026-07-28T12:00:00Z","summary":"Low chicken coverage"}]'::jsonb,
      'Review 38 lb.',
      'Review 38 lb.',
      'invalid-edit',
      'invalid-edit'
    )
  $sql$),
  false,
  'an edited decision requires a distinct action'
);
select is(
  pg_temp.try_execute($sql$
    select public.record_operational_finding_decision(
      'f0000000-0000-4000-8000-000000000001',
      'finding:recommendation:poisoned-evidence',
      'beta-findings-v1',
      'approved',
      now(),
      'ordering',
      'warning',
      0.8,
      '[{"type":"inventory_item","id":"chicken","observedAt":"2026-07-28T12:00:00Z","summary":"Low chicken coverage","access_token":"must-not-persist"}]'::jsonb,
      'Review 38 lb.',
      null,
      'poisoned-evidence',
      'poisoned-evidence'
    )
  $sql$),
  false,
  'evidence rejects extra fields before they can poison history or exports'
);
select is(
  (select count(*) from public.operational_finding_decisions),
  1::bigint,
  'RLS hides another tenant and denied writes create no duplicates'
);
reset role;

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'operational_finding.decision_recorded'
  ),
  1::bigint,
  'each accepted manager decision records one audit entry'
);

update public.system_operational_controls
set operational_mode = 'read_only';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_operational_finding_decision(
      'f0000000-0000-4000-8000-000000000001',
      'finding:data-gap:sales:read-only',
      'beta-findings-v1',
      'approved',
      now(),
      'data_quality',
      'warning',
      1,
      '[{"type":"data_gap","id":"sales:readonly","observedAt":"2026-07-28T12:00:00Z","summary":"Missing sales"}]'::jsonb,
      'Import sales.',
      null,
      'read-only-decision',
      'read-only-decision'
    )
  $sql$),
  false,
  'read-only mode blocks finding feedback mutations'
);
reset role;
update public.system_operational_controls
set operational_mode = 'normal';

set local role service_role;
select is(
  pg_temp.try_execute($sql$
    update public.operational_finding_decisions
    set severity = 'info'
    where restaurant_id = 'f0000000-0000-4000-8000-000000000001'
  $sql$),
  false,
  'the append-only trigger blocks privileged updates'
);
select is(
  pg_temp.try_execute($sql$
    delete from public.operational_finding_decisions
    where restaurant_id = 'f0000000-0000-4000-8000-000000000001'
  $sql$),
  false,
  'the append-only trigger blocks privileged deletes'
);
select is(
  pg_temp.try_execute($sql$
    update public.operational_finding_decisions
    set actor_user_id = null
    where restaurant_id = 'f0000000-0000-4000-8000-000000000001'
  $sql$),
  false,
  'service role cannot directly anonymize a finding decision actor'
);
select is(
  pg_temp.try_execute($sql$
    delete from public.restaurants
    where id = 'f0000000-0000-4000-8000-000000000002'
  $sql$),
  true,
  'whole-restaurant deletion can cascade immutable finding history'
);
select is(
  (
    select count(*)
    from public.operational_finding_decisions
    where restaurant_id = 'f0000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'tenant cascade removes the deleted restaurant decision set'
);
reset role;

select is(
  pg_temp.try_execute($sql$
    delete from auth.users
    where id = 'f1111111-1111-4111-8111-111111111111'
  $sql$),
  true,
  'an operator account can be deleted after recording finding feedback'
);
select is(
  (
    select count(*)
    from public.operational_finding_decisions
    where restaurant_id = 'f0000000-0000-4000-8000-000000000001'
      and client_event_id = 'manager-decision-1'
      and actor_user_id is null
  ),
  1::bigint,
  'account deletion preserves feedback and anonymizes only its actor'
);
select is(
  (
    select count(*)
    from public.operational_finding_decisions
    where restaurant_id = 'f0000000-0000-4000-8000-000000000001'
      and client_event_id = 'manager-decision-1'
      and idempotency_key = 'manager-decision-1'
  ),
  1::bigint,
  'account deletion preserves immutable replay identity'
);

select * from finish();
rollback;
