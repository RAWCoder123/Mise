create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' supplier_item_verified_by_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supplier-item-verified-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000a', 'Supplier Item Verified By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000a', 'c1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000090', 'c0000000-0000-4000-8000-00000000000a', 'Evidence Produce', 'evidence produce');

select has_function(
  'private',
  'enforce_supplier_item_verified_by_evidence',
  'supplier item verified_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_items (
      restaurant_id, supplier_id, supplier_name, item_name, unit,
      estimated_unit_cost, verification_status, verified_at, verified_by
    ) values (
      'c0000000-0000-4000-8000-00000000000a',
      'c0000000-0000-4000-8000-000000000090',
      'Evidence Produce', 'Roma tomatoes', 'lb',
      2.5, 'verified', now(), null
    )
  $sql$),
  'Supplier item verifier is required',
  'direct supplier_items insert cannot mint verified status without verified_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_items (
      id, restaurant_id, supplier_id, supplier_name, item_name, unit,
      estimated_unit_cost, verification_status, verified_at, verified_by
    ) values (
      'c0000000-0000-4000-8000-0000000000aa',
      'c0000000-0000-4000-8000-00000000000a',
      'c0000000-0000-4000-8000-000000000090',
      'Evidence Produce', 'San Marzano tomatoes', 'lb',
      3.0, 'verified', now(), 'c1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct supplier_items insert with verified_by remains allowed for verified status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.supplier_items (
      id, restaurant_id, supplier_id, supplier_name, item_name, unit,
      estimated_unit_cost, verification_status
    ) values (
      'c0000000-0000-4000-8000-0000000000ab',
      'c0000000-0000-4000-8000-00000000000a',
      'c0000000-0000-4000-8000-000000000090',
      'Evidence Produce', 'Cherry tomatoes', 'lb',
      2.0, 'draft'
    )
  $sql$),
  null,
  'direct supplier_items insert can open draft without verified_by'
);

select is(
  pg_temp.error_of($sql$
    update public.supplier_items
    set verification_status = 'verified',
      verified_at = clock_timestamp(),
      verified_by = 'c1111111-1111-4111-8111-11111111111a',
      updated_at = clock_timestamp()
    where id = 'c0000000-0000-4000-8000-0000000000ab'
  $sql$),
  null,
  'verification UPDATE with actor remains allowed (INSERT-only tip)'
);

select is(
  (
    select verified_by
    from public.supplier_items
    where id = 'c0000000-0000-4000-8000-0000000000ab'
  ),
  'c1111111-1111-4111-8111-11111111111a'::uuid,
  'verification UPDATE keeps the stamped verified_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'c1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after supplier_items verification history exists'
);

select is(
  (
    select count(*)
    from public.supplier_items
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
      and id = 'c0000000-0000-4000-8000-0000000000aa'
      and verified_by is null
      and verification_status = 'verified'
  ),
  1::bigint,
  'account deletion anonymizes verified_by without rewriting verification status'
);

select is(
  (
    select count(*)
    from public.supplier_items
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
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
