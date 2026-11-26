create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_transfer_location_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(9);

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
  ('h1111111-1111-4111-8111-111111111118', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'transfer-location-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('h0000000-0000-4000-8000-000000000008', 'Transfer Location Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('h0000000-0000-4000-8000-000000000008', 'h1111111-1111-4111-8111-111111111118', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('h0000000-0000-4000-8000-000000000080', 'h0000000-0000-4000-8000-000000000008', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'h0000000-0000-4000-8000-000000000081', 'h0000000-0000-4000-8000-000000000008',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'h0000000-0000-4000-8000-000000000080', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'h1111111-1111-4111-8111-111111111118'
  );

select has_function(
  'private',
  'enforce_inventory_transfer_location_evidence',
  'transfer location evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'h1111111-1111-4111-8111-111111111118', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'h0000000-0000-4000-8000-000000000008',
      'h0000000-0000-4000-8000-000000000081',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-loc-bare-1', 'idem-transfer-loc-bare-1',
      null, 'station_transfer', null, '{}'::jsonb
    )
  $sql$),
  'Inventory transfer events require from and to storage location ids',
  'manager JWT cannot mint transfer without from/to location ids'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'h0000000-0000-4000-8000-000000000008',
      'h0000000-0000-4000-8000-000000000081',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-loc-partial-1', 'idem-transfer-loc-partial-1',
      null, 'station_transfer', null,
      '{"from_storage_location_id":"h2222222-2222-4222-8222-222222222221"}'::jsonb
    )
  $sql$),
  'Inventory transfer events require from and to storage location ids',
  'manager JWT cannot mint transfer with only a from location id'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'h0000000-0000-4000-8000-000000000008',
      'h0000000-0000-4000-8000-000000000081',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-loc-garbage-1', 'idem-transfer-loc-garbage-1',
      null, 'station_transfer', null,
      '{"from_storage_location_id":"Main","to_storage_location_id":"Walk-in"}'::jsonb
    )
  $sql$),
  'Inventory transfer events require from and to storage location ids',
  'manager JWT cannot mint transfer with non-UUID location labels'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'h0000000-0000-4000-8000-000000000008',
      'h0000000-0000-4000-8000-000000000081',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-loc-same-1', 'idem-transfer-loc-same-1',
      null, 'station_transfer', null,
      jsonb_build_object(
        'from_storage_location_id', 'h2222222-2222-4222-8222-222222222221',
        'to_storage_location_id', 'H2222222-2222-4222-8222-222222222221'
      )
    )
  $sql$),
  'Inventory transfer storage locations are invalid',
  'manager JWT cannot mint transfer with the same from and to location'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'h0000000-0000-4000-8000-000000000008',
      'h0000000-0000-4000-8000-000000000081',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-loc-ok-1', 'idem-transfer-loc-ok-1',
      null, 'station_transfer', null,
      jsonb_build_object(
        'from_storage_location_id', 'h2222222-2222-4222-8222-222222222221',
        'to_storage_location_id', 'h3333333-3333-4333-8333-333333333331',
        'quantity_moved', 2
      )
    )
  $sql$),
  null,
  'manager JWT can record transfer with distinct UUID from/to location ids'
);

select is(
  (select metadata ->> 'from_storage_location_id' from public.inventory_events
    where client_event_id = 'client-transfer-loc-ok-1'),
  'h2222222-2222-4222-8222-222222222221',
  'accepted transfer keeps the from_storage_location_id evidence'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'h0000000-0000-4000-8000-000000000008',
      'h0000000-0000-4000-8000-000000000081',
      'receipt', 25, 'g', now(), 'operator_receipt',
      'client-receipt-no-loc-1', 'idem-receipt-no-loc-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-transfer events remain unconstrained by the transfer location guard'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'h0000000-0000-4000-8000-000000000008',
      'h0000000-0000-4000-8000-000000000081',
      'transfer', 0, 'g', now(),
      'h1111111-1111-4111-8111-111111111118',
      'transfer_inventory', 'client-transfer-loc-direct-1', 'idem-transfer-loc-direct-1',
      'station_transfer', '{}'::jsonb
    )
  $sql$),
  'Inventory transfer events require from and to storage location ids',
  'direct inventory_events insert cannot bypass the transfer location guard'
);

select * from finish();
rollback;
