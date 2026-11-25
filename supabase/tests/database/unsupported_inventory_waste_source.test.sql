create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' unsupported_inventory_waste_source.test.sql
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
  ('f1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'waste-source-allowlist-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-000000000001', 'Waste Source Allowlist Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-000000000001', 'f1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('f0000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000001', 'Allowlist Co', 'allowlist co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'f0000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'f0000000-0000-4000-8000-000000000010', 'Allowlist Co',
    'g', 453.592, 'verified', now(), 'f1111111-1111-4111-8111-111111111111'
  );

select has_function(
  'private',
  'reject_unsupported_inventory_waste_source',
  'unsupported inventory waste source guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 50, 'g', now(), 'manual',
      'client-waste-forged-1', 'idem-waste-forged-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory waste source must be operator_waste',
  'manager JWT cannot mint an arbitrary manual waste source'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 25, 'g', now(), 'Operator_Waste',
      'client-waste-forged-2', 'idem-waste-forged-2',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory waste source must be operator_waste',
  'manager JWT cannot mint a case-variant operator_waste label'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 10, 'g', now(), 'demo_waste',
      'client-waste-forged-3', 'idem-waste-forged-3',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory waste source must be operator_waste',
  'manager JWT cannot mint a demo_waste waste source on hosted ledger'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 15, 'g', now(), 'operator_waste',
      'client-waste-ok-1', 'idem-waste-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can still record operator_waste inventory source'
);

select is(
  (select source from public.inventory_events
    where client_event_id = 'client-waste-ok-1'),
  'operator_waste',
  'accepted operator waste keeps its source label'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-receipt-ok-1', 'idem-receipt-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-waste inventory sources remain unconstrained by the waste allowlist'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 20, 'g', now(),
      'f1111111-1111-4111-8111-111111111111',
      'manual', 'fixture-manual-waste-blocked-1', 'fixture-manual-waste-blocked-1'
    )
  $sql$),
  'Inventory waste source must be operator_waste',
  'direct inserts also reject unsupported waste sources'
);

select * from finish();
rollback;
