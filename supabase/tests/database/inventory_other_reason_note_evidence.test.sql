create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_other_reason_note_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(10);

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
  ('a1111111-1111-4111-8111-111111111141', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'other-reason-note-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-000000000041', 'Other Reason Note Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-000000000041', 'a1111111-1111-4111-8111-111111111141', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('a0000000-0000-4000-8000-000000000050', 'a0000000-0000-4000-8000-000000000041', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'a0000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-000000000041',
    'Tomatoes', 'Produce', 'lb', 10, 20, 5, 2,
    'a0000000-0000-4000-8000-000000000050', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'a1111111-1111-4111-8111-111111111141'
  );

select has_function(
  'private',
  'enforce_inventory_other_reason_note_evidence',
  'other-reason note evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111141', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'waste', 100, 'g', now(), 'operator_waste',
      'client-waste-other-bare-1', 'idem-waste-other-bare-1',
      null, 'other', null, '{}'::jsonb
    )
  $sql$),
  'Inventory waste events with reason other require a note',
  'manager JWT cannot mint waste other without a note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'waste', 100, 'g', now(), 'operator_waste',
      'client-waste-other-blank-1', 'idem-waste-other-blank-1',
      null, 'other', null, '{"note":"   "}'::jsonb
    )
  $sql$),
  'Inventory waste events with reason other require a note',
  'manager JWT cannot mint waste other with a whitespace-only note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'stockout', 0, 'g', now(), 'operator_stockout',
      'client-stockout-other-bare-1', 'idem-stockout-other-bare-1',
      null, 'other', null, '{}'::jsonb
    )
  $sql$),
  'Inventory stockout events with reason other require a note',
  'manager JWT cannot mint stockout other without a note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'waste', 50, 'g', now(), 'operator_waste',
      'client-waste-other-ok-1', 'idem-waste-other-ok-1',
      null, 'other', null,
      '{"note":"Vendor sent wrong variety"}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record waste other with a non-empty note'
);

select is(
  (select metadata ->> 'note' from public.inventory_events
    where client_event_id = 'client-waste-other-ok-1'),
  'Vendor sent wrong variety',
  'accepted waste other keeps the operator note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'stockout', 0, 'g', now(), 'operator_stockout',
      'client-stockout-other-ok-1', 'idem-stockout-other-ok-1',
      null, 'other', null,
      '{"note":"Walk-in cooler failure"}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record stockout other with a non-empty note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'waste', 25, 'g', now(), 'operator_waste',
      'client-waste-spoilage-1', 'idem-waste-spoilage-1',
      null, 'spoilage', null, '{}'::jsonb
    )
  $sql$),
  null,
  'named waste reasons remain note-optional'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'receipt', 25, 'g', now(), 'operator_receipt',
      'client-receipt-ok-1', 'idem-receipt-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-waste non-stockout events remain unconstrained by the other-note rule'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'a0000000-0000-4000-8000-000000000041',
      'a0000000-0000-4000-8000-000000000051',
      'waste', 10, 'g', now(),
      'a1111111-1111-4111-8111-111111111141',
      'operator_waste', 'client-waste-other-direct-1', 'idem-waste-other-direct-1',
      'other', '{}'::jsonb
    )
  $sql$),
  'Inventory waste events with reason other require a note',
  'direct inventory_events insert cannot bypass the other-note guard'
);

select * from finish();
rollback;
