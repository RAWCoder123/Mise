create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' forged_approve_count_session_source.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(7);

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
  ('d1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'count-session-forge-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-000000000001', 'Count Session Forge Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-000000000001', 'd1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000001', 'Forge Co', 'forge co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'd0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'd0000000-0000-4000-8000-000000000010', 'Forge Co',
    'g', 453.592, 'verified', now(), 'd1111111-1111-4111-8111-111111111111'
  );

select has_function(
  'private',
  'reject_forged_approve_count_session_source',
  'forged approve_count_session inventory source guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'approve_count_session',
      'client-session-forged-1', 'idem-session-forged-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source cannot claim count-session provenance',
  'manager JWT cannot mint approve_count_session on a receipt'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'waste', 50, 'g', now(), 'Approve_Count_Session',
      'client-session-forged-2', 'idem-session-forged-2',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source cannot claim count-session provenance',
  'manager JWT cannot mint case-insensitive approve_count_session on waste'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'count', 1, 'g', now(), 'approve_count_session',
      'client-session-forged-count', 'idem-session-forged-count',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source cannot claim count-session provenance',
  'manager JWT cannot mint approve_count_session even on a count via RPC'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-operator-ok-1', 'idem-operator-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can still record operator_receipt inventory source'
);

select is(
  (select source from public.inventory_events
    where client_event_id = 'client-operator-ok-1'),
  'operator_receipt',
  'accepted operator receipt keeps its source label'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values (
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'count', 1, 'g', now(),
      'd1111111-1111-4111-8111-111111111111',
      'approve_count_session', 'fixture-session-seed-1', 'fixture-session-seed-1'
    )
  $sql$),
  null,
  'unauthenticated fixture seeds may still stamp approve_count_session on counts'
);

select * from finish();
rollback;
