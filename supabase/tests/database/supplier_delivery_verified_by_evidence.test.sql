create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' supplier_delivery_verified_by_evidence.test.sql
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
  ('e1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'delivery-verified-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-00000000000a', 'Delivery Verified By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-00000000000a', 'e1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000090', 'e0000000-0000-4000-8000-00000000000a', 'Evidence Produce', 'evidence produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'e0000000-0000-4000-8000-000000000091', 'e0000000-0000-4000-8000-00000000000a',
    'Roma tomatoes', 'Produce', 'lb', 10, 20, 5, 2.5,
    'e0000000-0000-4000-8000-000000000090', 'Evidence Produce',
    'g', 453.592, 'verified', now(), 'e1111111-1111-4111-8111-11111111111a'
  );

insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
) values (
  'e0000000-0000-4000-8000-000000000092',
  'e0000000-0000-4000-8000-00000000000a',
  'e0000000-0000-4000-8000-000000000090',
  'Evidence Produce', 'Sent evidence order', 'sent', current_date + 1
);

insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
) values (
  'e0000000-0000-4000-8000-000000000093',
  'e0000000-0000-4000-8000-00000000000a',
  'e0000000-0000-4000-8000-000000000090',
  'Evidence Produce', 'RPC evidence order', 'sent', current_date + 1
);

select has_function(
  'private',
  'enforce_supplier_delivery_verified_by_evidence',
  'supplier delivery verified_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_deliveries (
      restaurant_id, supplier_order_id, status, received_at, verified_by,
      client_delivery_id, idempotency_key, notes
    ) values (
      'e0000000-0000-4000-8000-00000000000a',
      'e0000000-0000-4000-8000-000000000092',
      'unverified',
      now(),
      null,
      'null-verifier-probe',
      'supplier_delivery:null-verifier-probe',
      'null verifier probe'
    )
  $sql$),
  'Supplier delivery verifier is required',
  'direct supplier_deliveries insert cannot mint an unattributable null verified_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_deliveries (
      id, restaurant_id, supplier_order_id, status, received_at, verified_by,
      client_delivery_id, idempotency_key, notes
    ) values (
      'e0000000-0000-4000-8000-0000000000aa',
      'e0000000-0000-4000-8000-00000000000a',
      'e0000000-0000-4000-8000-000000000092',
      'unverified',
      now(),
      'e1111111-1111-4111-8111-11111111111a',
      'attributed-verifier-probe',
      'supplier_delivery:attributed-verifier-probe',
      'attributed verifier probe'
    )
  $sql$),
  null,
  'direct supplier_deliveries insert with a real verified_by remains allowed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_supplier_delivery(
      'e0000000-0000-4000-8000-00000000000a',
      'e0000000-0000-4000-8000-000000000093',
      'rpc-verifier-probe',
      now(),
      '[{"inventoryItemId":"e0000000-0000-4000-8000-000000000091","orderedQuantity":453.592,"receivedQuantity":453.592,"damagedQuantity":0,"missingQuantity":0,"canonicalUnit":"g","unitPrice":2.5}]'::jsonb,
      2.5,
      'rpc verifier probe'
    )
  $sql$),
  null,
  'hosted record_supplier_delivery can create a delivery with actor verifier attribution'
);

reset role;

select is(
  (
    select verified_by
    from public.supplier_deliveries
    where restaurant_id = 'e0000000-0000-4000-8000-00000000000a'
      and client_delivery_id = 'rpc-verifier-probe'
  ),
  'e1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted record_supplier_delivery keeps the authenticated verified_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'e1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after supplier-delivery history exists'
);

select is(
  (
    select count(*)
    from public.supplier_deliveries
    where restaurant_id = 'e0000000-0000-4000-8000-00000000000a'
      and client_delivery_id = 'rpc-verifier-probe'
      and verified_by is null
  ),
  1::bigint,
  'account deletion anonymizes verified_by without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.supplier_deliveries
    where restaurant_id = 'e0000000-0000-4000-8000-00000000000a'
      and client_delivery_id = 'rpc-verifier-probe'
      and notes = 'rpc verifier probe'
  ),
  1::bigint,
  'account deletion preserves immutable supplier-delivery business fields'
);

select * from finish();
rollback;
