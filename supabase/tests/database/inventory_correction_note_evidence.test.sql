create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_correction_note_evidence.test.sql
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
  ('c1111111-1111-4111-8111-111111111131', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'correction-note-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-000000000031', 'Correction Note Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-000000000031', 'c1111111-1111-4111-8111-111111111131', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000040', 'c0000000-0000-4000-8000-000000000031', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'c0000000-0000-4000-8000-000000000041', 'c0000000-0000-4000-8000-000000000031',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'c0000000-0000-4000-8000-000000000040', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'c1111111-1111-4111-8111-111111111131'
  );

select has_function(
  'private',
  'enforce_inventory_correction_note_evidence',
  'correction note evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111131', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000031',
      'c0000000-0000-4000-8000-000000000041',
      'correction', -100, 'g', now(), 'operator_correction',
      'client-correction-bare-1', 'idem-correction-bare-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory correction events require a note',
  'manager JWT cannot mint correction without a note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000031',
      'c0000000-0000-4000-8000-000000000041',
      'correction', -50, 'g', now(), 'operator_correction',
      'client-correction-blank-1', 'idem-correction-blank-1',
      null, null, null, '{"note":"   "}'::jsonb
    )
  $sql$),
  'Inventory correction events require a note',
  'manager JWT cannot mint correction with a whitespace-only note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000031',
      'c0000000-0000-4000-8000-000000000041',
      'correction', -25, 'g', now(), 'operator_correction',
      'client-correction-ok-1', 'idem-correction-ok-1',
      null, 'waste_correction', null,
      '{"note":"Mistaken waste entry"}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record correction with a non-empty note'
);

select is(
  (select metadata ->> 'note' from public.inventory_events
    where client_event_id = 'client-correction-ok-1'),
  'Mistaken waste entry',
  'accepted correction persists its operator note'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000031',
      'c0000000-0000-4000-8000-000000000041',
      'correction', -10, 'g', now(), 'operator_correction',
      'client-correction-padded-1', 'idem-correction-padded-1',
      null, 'receipt_correction', null,
      '{"note":"  padded ok  "}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record correction when the trimmed note is non-empty'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000031',
      'c0000000-0000-4000-8000-000000000041',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-receipt-ok-1', 'idem-receipt-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-correction inventory events remain unconstrained by the correction note rule'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      metadata
    ) values (
      'c0000000-0000-4000-8000-000000000031',
      'c0000000-0000-4000-8000-000000000041',
      'correction', -50, 'g', now(),
      'c1111111-1111-4111-8111-111111111131',
      'operator_correction', 'fixture-correction-note-blocked-1',
      'fixture-correction-note-blocked-1', '{}'::jsonb
    )
  $sql$),
  'Inventory correction events require a note',
  'direct inserts also reject corrections without a note'
);

select * from finish();
rollback;
