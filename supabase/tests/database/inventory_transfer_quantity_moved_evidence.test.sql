create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_transfer_quantity_moved_evidence.test.sql
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
  ('i1111111-1111-4111-8111-111111111119', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'transfer-qty-moved-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('i0000000-0000-4000-8000-000000000009', 'Transfer Qty Moved Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('i0000000-0000-4000-8000-000000000009', 'i1111111-1111-4111-8111-111111111119', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('i0000000-0000-4000-8000-000000000090', 'i0000000-0000-4000-8000-000000000009', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'i0000000-0000-4000-8000-000000000091', 'i0000000-0000-4000-8000-000000000009',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'i0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'i1111111-1111-4111-8111-111111111119'
  );

select has_function(
  'private',
  'enforce_inventory_transfer_quantity_moved_evidence',
  'transfer quantity_moved evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'i1111111-1111-4111-8111-111111111119', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'i0000000-0000-4000-8000-000000000009',
      'i0000000-0000-4000-8000-000000000091',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-qty-bare-1', 'idem-transfer-qty-bare-1',
      null, 'station_transfer', null, '{}'::jsonb
    )
  $sql$),
  'Inventory transfer events require a positive quantity_moved',
  'manager JWT cannot mint transfer without quantity_moved'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'i0000000-0000-4000-8000-000000000009',
      'i0000000-0000-4000-8000-000000000091',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-qty-zero-1', 'idem-transfer-qty-zero-1',
      null, 'station_transfer', null,
      '{"quantity_moved":0}'::jsonb
    )
  $sql$),
  'Inventory transfer events require a positive quantity_moved',
  'manager JWT cannot mint transfer with quantity_moved of zero'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'i0000000-0000-4000-8000-000000000009',
      'i0000000-0000-4000-8000-000000000091',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-qty-neg-1', 'idem-transfer-qty-neg-1',
      null, 'station_transfer', null,
      '{"quantity_moved":-2}'::jsonb
    )
  $sql$),
  'Inventory transfer events require a positive quantity_moved',
  'manager JWT cannot mint transfer with negative quantity_moved'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'i0000000-0000-4000-8000-000000000009',
      'i0000000-0000-4000-8000-000000000091',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-qty-str-1', 'idem-transfer-qty-str-1',
      null, 'station_transfer', null,
      '{"quantity_moved":"2"}'::jsonb
    )
  $sql$),
  'Inventory transfer events require a positive quantity_moved',
  'manager JWT cannot mint transfer with non-number quantity_moved'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'i0000000-0000-4000-8000-000000000009',
      'i0000000-0000-4000-8000-000000000091',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-qty-ok-1', 'idem-transfer-qty-ok-1',
      null, 'station_transfer', null,
      jsonb_build_object('quantity_moved', 2)
    )
  $sql$),
  null,
  'manager JWT can record transfer with positive quantity_moved'
);

select is(
  (select metadata ->> 'quantity_moved' from public.inventory_events
    where client_event_id = 'client-transfer-qty-ok-1'),
  '2',
  'accepted transfer keeps the quantity_moved evidence'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'i0000000-0000-4000-8000-000000000009',
      'i0000000-0000-4000-8000-000000000091',
      'receipt', 25, 'g', now(), 'operator_receipt',
      'client-receipt-no-qty-1', 'idem-receipt-no-qty-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-transfer events remain unconstrained by the transfer quantity_moved guard'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'i0000000-0000-4000-8000-000000000009',
      'i0000000-0000-4000-8000-000000000091',
      'transfer', 0, 'g', now(),
      'i1111111-1111-4111-8111-111111111119',
      'transfer_inventory', 'client-transfer-qty-direct-1', 'idem-transfer-qty-direct-1',
      'station_transfer', '{}'::jsonb
    )
  $sql$),
  'Inventory transfer events require a positive quantity_moved',
  'direct inventory_events insert cannot bypass the transfer quantity_moved guard'
);

select * from finish();
rollback;
