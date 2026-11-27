create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_count_session_approved_submit_time_evidence.test.sql
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
  ('e1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'count-session-approved-submit-time-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-00000000000a', 'Count Session Approved Submit Time Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-00000000000a', 'e1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000090', 'e0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'e0000000-0000-4000-8000-000000000091', 'e0000000-0000-4000-8000-00000000000a',
    'Onions', 'Produce', 'lb', 10, 20, 5, 1.5,
    'e0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'e1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_inventory_count_session_approved_submit_time_evidence',
  'inventory count session approved submit-time evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      restaurant_id, status, started_by, started_at, approved_by, approved_at, note
    ) values (
      'e0000000-0000-4000-8000-00000000000a',
      'approved',
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'null submitted_at approved probe'
    )
  $sql$),
  'Inventory count session submit time is required for approved inserts',
  'direct inventory_count_sessions insert cannot mint approved status without submitted_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at,
      submitted_by, submitted_at, approved_by, approved_at, note
    ) values (
      'e0000000-0000-4000-8000-0000000000aa',
      'e0000000-0000-4000-8000-00000000000a',
      'approved',
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'attributed approved with submit time probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert with submitted_at remains allowed for approved status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at, note
    ) values (
      'e0000000-0000-4000-8000-0000000000ab',
      'e0000000-0000-4000-8000-00000000000a',
      'in_progress',
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'open in_progress without submitted_at'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert can open in_progress without submitted_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at,
      submitted_by, submitted_at, note
    ) values (
      'e0000000-0000-4000-8000-0000000000ac',
      'e0000000-0000-4000-8000-00000000000a',
      'submitted',
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'submitted without approval probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert can mint submitted status under the approved-only tip'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at,
      cancelled_by, cancelled_at, note
    ) values (
      'e0000000-0000-4000-8000-0000000000ad',
      'e0000000-0000-4000-8000-00000000000a',
      'cancelled',
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'e1111111-1111-4111-8111-11111111111a',
      now(),
      'cancelled without submitted_at probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert can mint cancelled status without submitted_at'
);

select is(
  pg_temp.error_of($sql$
    update public.inventory_count_sessions
    set status = 'approved',
      approved_by = 'e1111111-1111-4111-8111-11111111111a',
      approved_at = clock_timestamp()
    where id = 'e0000000-0000-4000-8000-0000000000ac'
  $sql$),
  null,
  'approve UPDATE with inherited submitted_at remains allowed (INSERT-only tip)'
);

select is(
  (
    select (submitted_at is not null and status = 'approved')
    from public.inventory_count_sessions
    where id = 'e0000000-0000-4000-8000-0000000000ac'
  ),
  true,
  'approve UPDATE keeps the inherited submitted_at on approved status'
);

select is(
  pg_temp.error_of($sql$
    select private.service_begin_inventory_count_session(
      'e1111111-1111-4111-8111-11111111111a',
      'e0000000-0000-4000-8000-00000000000a',
      'rpc begin under approved submit-time tip'
    )
  $sql$),
  null,
  'hosted begin RPC can open an in_progress count session under the INSERT-only tip'
);

select * from finish();
rollback;
