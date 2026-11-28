create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_count_session_approved_submitter_evidence.test.sql
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
  ('f1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'count-session-approved-submitter-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-00000000000a', 'Count Session Approved Submitter Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-00000000000a', 'f1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('f0000000-0000-4000-8000-000000000090', 'f0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'f0000000-0000-4000-8000-000000000091', 'f0000000-0000-4000-8000-00000000000a',
    'Onions', 'Produce', 'lb', 10, 20, 5, 1.5,
    'f0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'f1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_inventory_count_session_approved_submitter_evidence',
  'inventory count session approved submitter evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      restaurant_id, status, started_by, started_at,
      submitted_at, approved_by, approved_at, note
    ) values (
      'f0000000-0000-4000-8000-00000000000a',
      'approved',
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      now(),
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'null submitted_by approved probe'
    )
  $sql$),
  'Inventory count session submitter is required for approved inserts',
  'direct inventory_count_sessions insert cannot mint approved status without submitted_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at,
      submitted_by, submitted_at, approved_by, approved_at, note
    ) values (
      'f0000000-0000-4000-8000-0000000000aa',
      'f0000000-0000-4000-8000-00000000000a',
      'approved',
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'attributed approved with submitter probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert with submitted_by remains allowed for approved status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at, note
    ) values (
      'f0000000-0000-4000-8000-0000000000ab',
      'f0000000-0000-4000-8000-00000000000a',
      'in_progress',
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'open in_progress without submitted_by'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert can open in_progress without submitted_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at,
      submitted_by, submitted_at, note
    ) values (
      'f0000000-0000-4000-8000-0000000000ac',
      'f0000000-0000-4000-8000-00000000000a',
      'submitted',
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'f1111111-1111-4111-8111-11111111111a',
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
      'f0000000-0000-4000-8000-0000000000ad',
      'f0000000-0000-4000-8000-00000000000a',
      'cancelled',
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'f1111111-1111-4111-8111-11111111111a',
      now(),
      'cancelled without submitted_by probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert can mint cancelled status without submitted_by'
);

select is(
  pg_temp.error_of($sql$
    update public.inventory_count_sessions
    set status = 'approved',
      approved_by = 'f1111111-1111-4111-8111-11111111111a',
      approved_at = clock_timestamp()
    where id = 'f0000000-0000-4000-8000-0000000000ac'
  $sql$),
  null,
  'approve UPDATE with inherited submitted_by remains allowed (INSERT-only tip)'
);

select is(
  (
    select (submitted_by is not null and status = 'approved')
    from public.inventory_count_sessions
    where id = 'f0000000-0000-4000-8000-0000000000ac'
  ),
  true,
  'approve UPDATE keeps the inherited submitted_by on approved status'
);

select is(
  pg_temp.error_of($sql$
    select private.service_begin_inventory_count_session(
      'f1111111-1111-4111-8111-11111111111a',
      'f0000000-0000-4000-8000-00000000000a',
      'rpc begin under approved submitter tip'
    )
  $sql$),
  null,
  'hosted begin RPC can open an in_progress count session under the INSERT-only tip'
);

select * from finish();
rollback;
