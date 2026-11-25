create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' mismatched_operator_inventory_source.test.sql
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
  ('e1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'operator-mismatch-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-000000000001', 'Operator Mismatch Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000001', 'Mismatch Co', 'mismatch co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'e0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'e0000000-0000-4000-8000-000000000010', 'Mismatch Co',
    'g', 453.592, 'verified', now(), 'e1111111-1111-4111-8111-111111111111'
  );

select has_function(
  'private',
  'reject_mismatched_operator_inventory_source',
  'mismatched operator inventory source guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'waste', 50, 'g', now(), 'operator_receipt',
      'client-mismatch-waste-1', 'idem-mismatch-waste-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory operator source must match the operation',
  'manager JWT cannot mint operator_receipt on a waste event'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_waste',
      'client-mismatch-receipt-1', 'idem-mismatch-receipt-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory operator source must match the operation',
  'manager JWT cannot mint operator_waste on a receipt event'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'waste', 50, 'g', now(), 'Operator_Waste',
      'client-mismatch-case-1', 'idem-mismatch-case-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory operator source must match the operation',
  'manager JWT cannot mint case-variant operator_waste labels'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-operator-ok-1', 'idem-operator-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can still record matching operator_receipt inventory source'
);

select is(
  (select source from public.inventory_events
    where client_event_id = 'client-operator-ok-1'),
  'operator_receipt',
  'accepted matching operator receipt keeps its source label'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'waste', 25, 'g', now(), 'operator_waste',
      'client-operator-waste-ok', 'idem-operator-waste-ok',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can still record matching operator_waste inventory source'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values (
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'count', 1, 'g', now(),
      'e1111111-1111-4111-8111-111111111111',
      'operator_receipt', 'fixture-mismatch-1', 'fixture-mismatch-1'
    )
  $sql$),
  'Inventory operator source must match the operation',
  'direct inserts also reject mismatched operator_* sources'
);

select * from finish();
rollback;
