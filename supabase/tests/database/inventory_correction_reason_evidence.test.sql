create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_correction_reason_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(8);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d1111111-1111-4111-8111-111111111141', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'correction-reason-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-000000000041', 'Correction Reason Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-000000000041', 'd1111111-1111-4111-8111-111111111141', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('d0000000-0000-4000-8000-000000000050', 'd0000000-0000-4000-8000-000000000041', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'd0000000-0000-4000-8000-000000000051', 'd0000000-0000-4000-8000-000000000041',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'd0000000-0000-4000-8000-000000000050', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'd1111111-1111-4111-8111-111111111141'
  );

select has_function(
  'private',
  'enforce_inventory_correction_reason_evidence',
  'correction reason evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111141', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000041',
      'd0000000-0000-4000-8000-000000000051',
      'correction', -100, 'g', now(), 'operator_correction',
      'client-correction-bare-1', 'idem-correction-bare-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory correction events require a reason code',
  'manager JWT cannot mint correction without a reason code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000041',
      'd0000000-0000-4000-8000-000000000051',
      'correction', -100, 'g', now(), 'operator_correction',
      'client-correction-bad-1', 'idem-correction-bad-1',
      null, 'manual_fix', null, '{}'::jsonb
    )
  $sql$),
  'Inventory correction reason code is not allowed',
  'manager JWT cannot mint correction with a non-allowlisted reason'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000041',
      'd0000000-0000-4000-8000-000000000051',
      'correction', -100, 'g', now(), 'operator_correction',
      'client-correction-case-1', 'idem-correction-case-1',
      null, 'Waste_Correction', null, '{}'::jsonb
    )
  $sql$),
  'Inventory correction reason code is not allowed',
  'manager JWT cannot mint correction with a case-variant reason'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000041',
      'd0000000-0000-4000-8000-000000000051',
      'correction', -50, 'g', now(), 'operator_correction',
      'client-correction-ok-1', 'idem-correction-ok-1',
      null, 'waste_correction', null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record correction with an allowlisted reason'
);

select is(
  (select reason_code from public.inventory_events
    where client_event_id = 'client-correction-ok-1'),
  'waste_correction',
  'accepted correction keeps the allowlisted reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000041',
      'd0000000-0000-4000-8000-000000000051',
      'receipt', 25, 'g', now(), 'operator_receipt',
      'client-receipt-no-reason-1', 'idem-receipt-no-reason-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-correction events remain unconstrained by the correction reason allowlist'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'd0000000-0000-4000-8000-000000000041',
      'd0000000-0000-4000-8000-000000000051',
      'correction', -10, 'g', now(),
      'd1111111-1111-4111-8111-111111111141',
      'operator_correction', 'client-correction-direct-1', 'idem-correction-direct-1',
      null, '{}'::jsonb
    )
  $sql$),
  'Inventory correction events require a reason code',
  'direct inventory_events insert cannot bypass the correction reason guard'
);

select * from finish();
rollback;
