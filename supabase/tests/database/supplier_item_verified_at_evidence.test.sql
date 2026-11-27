create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' supplier_item_verified_at_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supplier-item-verified-at-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000d', 'Supplier Item Verified At Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000d', 'c1111111-1111-4111-8111-11111111111d', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000090', 'c0000000-0000-4000-8000-00000000000d', 'Evidence Produce At', 'evidence produce at');

select has_function(
  'private',
  'enforce_supplier_item_verified_at_evidence',
  'supplier item verified_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_items (
      restaurant_id, supplier_id, supplier_name, item_name, unit,
      estimated_unit_cost, verification_status, verified_at, verified_by
    ) values (
      'c0000000-0000-4000-8000-00000000000d',
      'c0000000-0000-4000-8000-000000000090',
      'Evidence Produce At', 'Roma tomatoes', 'lb',
      2.5, 'verified', null, 'c1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Supplier item verification time is required',
  'direct supplier_items insert cannot mint verified status without verified_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_items (
      id, restaurant_id, supplier_id, supplier_name, item_name, unit,
      estimated_unit_cost, verification_status, verified_at, verified_by
    ) values (
      'c0000000-0000-4000-8000-0000000000aa',
      'c0000000-0000-4000-8000-00000000000d',
      'c0000000-0000-4000-8000-000000000090',
      'Evidence Produce At', 'San Marzano tomatoes', 'lb',
      3.0, 'verified', '2024-01-02T00:00:00Z'::timestamptz,
      'c1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  null,
  'direct supplier_items insert with verified_at remains allowed for verified status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_items (
      id, restaurant_id, supplier_id, supplier_name, item_name, unit,
      estimated_unit_cost, verification_status
    ) values (
      'c0000000-0000-4000-8000-0000000000ab',
      'c0000000-0000-4000-8000-00000000000d',
      'c0000000-0000-4000-8000-000000000090',
      'Evidence Produce At', 'Cherry tomatoes', 'lb',
      2.0, 'draft'
    )
  $sql$),
  null,
  'direct supplier_items insert can open draft without verified_at'
);

select is(
  pg_temp.error_of($sql$
    update public.supplier_items
    set verification_status = 'verified',
      verified_at = clock_timestamp(),
      verified_by = 'c1111111-1111-4111-8111-11111111111d',
      updated_at = clock_timestamp()
    where id = 'c0000000-0000-4000-8000-0000000000ab'
  $sql$),
  null,
  'verification UPDATE with verified_at remains allowed (INSERT-only tip)'
);

select is(
  (
    select (verified_at is not null)
    from public.supplier_items
    where id = 'c0000000-0000-4000-8000-0000000000ab'
  ),
  true,
  'verification UPDATE keeps the stamped verified_at'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'c1111111-1111-4111-8111-11111111111d'
  $sql$),
  null,
  'account deletion remains allowed after supplier_items verification history exists'
);

select is(
  (
    select count(*)
    from public.supplier_items
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000d'
      and id = 'c0000000-0000-4000-8000-0000000000aa'
      and verified_by is null
      and verified_at is not null
      and verification_status = 'verified'
  ),
  1::bigint,
  'account deletion anonymizes verified_by while preserving verified_at'
);

select is(
  (
    select count(*)
    from public.supplier_items
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000d'
      and id = 'c0000000-0000-4000-8000-0000000000aa'
      and item_name = 'San Marzano tomatoes'
      and unit = 'lb'
      and supplier_id = 'c0000000-0000-4000-8000-000000000090'
  ),
  1::bigint,
  'account deletion preserves immutable supplier_items business fields'
);

select * from finish();
rollback;
