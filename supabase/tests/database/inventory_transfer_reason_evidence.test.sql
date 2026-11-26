create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_transfer_reason_evidence.test.sql
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
  ('g1111111-1111-4111-8111-111111111117', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'transfer-reason-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('g0000000-0000-4000-8000-000000000007', 'Transfer Reason Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('g0000000-0000-4000-8000-000000000007', 'g1111111-1111-4111-8111-111111111117', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('g0000000-0000-4000-8000-000000000070', 'g0000000-0000-4000-8000-000000000007', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'g0000000-0000-4000-8000-000000000071', 'g0000000-0000-4000-8000-000000000007',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'g0000000-0000-4000-8000-000000000070', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'g1111111-1111-4111-8111-111111111117'
  );

select has_function(
  'private',
  'enforce_inventory_transfer_reason_evidence',
  'transfer reason evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'g1111111-1111-4111-8111-111111111117', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'g0000000-0000-4000-8000-000000000007',
      'g0000000-0000-4000-8000-000000000071',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-bare-1', 'idem-transfer-bare-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory transfer events require a reason code',
  'manager JWT cannot mint transfer without a reason code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'g0000000-0000-4000-8000-000000000007',
      'g0000000-0000-4000-8000-000000000071',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-bad-1', 'idem-transfer-bad-1',
      null, 'manual_move', null, '{}'::jsonb
    )
  $sql$),
  'Inventory transfer reason code is not allowed',
  'manager JWT cannot mint transfer with a non-allowlisted reason'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'g0000000-0000-4000-8000-000000000007',
      'g0000000-0000-4000-8000-000000000071',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-case-1', 'idem-transfer-case-1',
      null, 'Station_Transfer', null, '{}'::jsonb
    )
  $sql$),
  'Inventory transfer reason code is not allowed',
  'manager JWT cannot mint transfer with a case-variant reason'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'g0000000-0000-4000-8000-000000000007',
      'g0000000-0000-4000-8000-000000000071',
      'transfer', 0, 'g', now(), 'transfer_inventory',
      'client-transfer-ok-1', 'idem-transfer-ok-1',
      null, 'station_transfer', null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record transfer with an allowlisted reason'
);

select is(
  (select reason_code from public.inventory_events
    where client_event_id = 'client-transfer-ok-1'),
  'station_transfer',
  'accepted transfer keeps the allowlisted reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'g0000000-0000-4000-8000-000000000007',
      'g0000000-0000-4000-8000-000000000071',
      'receipt', 25, 'g', now(), 'operator_receipt',
      'client-receipt-no-reason-1', 'idem-receipt-no-reason-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-transfer events remain unconstrained by the transfer reason allowlist'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'g0000000-0000-4000-8000-000000000007',
      'g0000000-0000-4000-8000-000000000071',
      'transfer', 0, 'g', now(),
      'g1111111-1111-4111-8111-111111111117',
      'transfer_inventory', 'client-transfer-direct-1', 'idem-transfer-direct-1',
      null, '{}'::jsonb
    )
  $sql$),
  'Inventory transfer events require a reason code',
  'direct inventory_events insert cannot bypass the transfer reason guard'
);

select * from finish();
rollback;
