create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_blank_source_reference_evidence.test.sql
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
  ('b1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'blank-source-ref-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('b0000000-0000-4000-8000-00000000000a', 'Blank Source Ref Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('b0000000-0000-4000-8000-00000000000a', 'b1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('b0000000-0000-4000-8000-000000000090', 'b0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'b0000000-0000-4000-8000-000000000091', 'b0000000-0000-4000-8000-00000000000a',
    'Onions', 'Produce', 'lb', 10, 20, 5, 1.5,
    'b0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'b1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_inventory_blank_source_reference_evidence',
  'blank source_reference evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, source_reference,
      client_event_id, idempotency_key, reason_code, metadata
    ) values (
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      'b1111111-1111-4111-8111-11111111111a',
      'operator_adjustment', '   ',
      'client-blank-source-ref-spaces-1', 'idem-blank-source-ref-spaces-1',
      null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source reference must be non-blank and unpadded',
  'direct insert rejects whitespace-only source_reference'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, source_reference,
      client_event_id, idempotency_key, reason_code, metadata
    ) values (
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      'b1111111-1111-4111-8111-11111111111a',
      'operator_adjustment', E'\t\n',
      'client-blank-source-ref-tabs-1', 'idem-blank-source-ref-tabs-1',
      null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source reference must be non-blank and unpadded',
  'direct insert rejects tab/newline-only source_reference'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, source_reference,
      client_event_id, idempotency_key, reason_code, metadata
    ) values (
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      'b1111111-1111-4111-8111-11111111111a',
      'operator_adjustment', '  delivery-1  ',
      'client-blank-source-ref-padded-1', 'idem-blank-source-ref-padded-1',
      null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source reference must be non-blank and unpadded',
  'direct insert rejects padded source_reference'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-blank-source-ref-rpc-blank-1', 'idem-blank-source-ref-rpc-blank-1',
      '   ', null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'RPC blank source_reference still nullifies and records'
);

select is(
  (select source_reference from public.inventory_events
    where client_event_id = 'client-blank-source-ref-rpc-blank-1'),
  null,
  'RPC blank source_reference stores null'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-blank-source-ref-rpc-padded-1', 'idem-blank-source-ref-rpc-padded-1',
      '  delivery-1  ', null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'RPC padded source_reference still trims and records'
);

select is(
  (select source_reference from public.inventory_events
    where client_event_id = 'client-blank-source-ref-rpc-padded-1'),
  'delivery-1',
  'RPC padded source_reference stores the trimmed label'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, source_reference,
      client_event_id, idempotency_key, reason_code, metadata
    ) values (
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      'b1111111-1111-4111-8111-11111111111a',
      'operator_adjustment', 'delivery-1',
      'client-blank-source-ref-ok-1', 'idem-blank-source-ref-ok-1',
      null, '{}'::jsonb
    )
  $sql$),
  null,
  'direct insert accepts a trimmed non-empty source_reference'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, source_reference,
      client_event_id, idempotency_key, reason_code, metadata
    ) values (
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      'b1111111-1111-4111-8111-11111111111a',
      'operator_adjustment', null,
      'client-blank-source-ref-null-1', 'idem-blank-source-ref-null-1',
      null, '{}'::jsonb
    )
  $sql$),
  null,
  'direct insert still allows null source_reference'
);

select * from finish();
rollback;
