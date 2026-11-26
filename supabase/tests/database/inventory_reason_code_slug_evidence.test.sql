create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_reason_code_slug_evidence.test.sql
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
  ('j1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reason-code-slug-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('j0000000-0000-4000-8000-00000000000a', 'Reason Code Slug Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('j0000000-0000-4000-8000-00000000000a', 'j1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('j0000000-0000-4000-8000-000000000090', 'j0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'j0000000-0000-4000-8000-000000000091', 'j0000000-0000-4000-8000-00000000000a',
    'Onions', 'Produce', 'lb', 10, 20, 5, 1.5,
    'j0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'j1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_inventory_reason_code_slug_evidence',
  'reason code slug evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'j1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-reason-slug-space-1', 'idem-reason-slug-space-1',
      null, 'bad code', null, '{}'::jsonb
    )
  $sql$),
  'Inventory event reason code must be a slug',
  'manager JWT cannot mint an event with a spaced reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-reason-slug-case-1', 'idem-reason-slug-case-1',
      null, 'Spoilage', null, '{}'::jsonb
    )
  $sql$),
  'Inventory event reason code must be a slug',
  'manager JWT cannot mint an event with a case-variant reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-reason-slug-short-1', 'idem-reason-slug-short-1',
      null, 'ab', null, '{}'::jsonb
    )
  $sql$),
  'Inventory event reason code must be a slug',
  'manager JWT cannot mint an event with a too-short reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-reason-slug-hyphen-1', 'idem-reason-slug-hyphen-1',
      null, 'bad-code', null, '{}'::jsonb
    )
  $sql$),
  'Inventory event reason code must be a slug',
  'manager JWT cannot mint an event with a hyphenated reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-reason-slug-long-1', 'idem-reason-slug-long-1',
      null, repeat('a', 65), null, '{}'::jsonb
    )
  $sql$),
  'Inventory event reason code must be a slug',
  'manager JWT cannot mint an event with an overlong reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-reason-slug-ok-1', 'idem-reason-slug-ok-1',
      null, 'spoilage', null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record an event with a slug reason_code'
);

select is(
  (select reason_code from public.inventory_events
    where client_event_id = 'client-reason-slug-ok-1'),
  'spoilage',
  'accepted event keeps the slug reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'receipt', 25, 'g', now(), 'operator_receipt',
      'client-receipt-no-reason-slug-1', 'idem-receipt-no-reason-slug-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'events with a null reason_code remain unconstrained by the slug guard'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'j0000000-0000-4000-8000-00000000000a',
      'j0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      'j1111111-1111-4111-8111-11111111111a',
      'operator_adjustment', 'client-reason-slug-direct-1', 'idem-reason-slug-direct-1',
      'Not A Slug', '{}'::jsonb
    )
  $sql$),
  'Inventory event reason code must be a slug',
  'direct inventory_events insert cannot bypass the reason_code slug guard'
);

select * from finish();
rollback;
