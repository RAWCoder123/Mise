create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' ingredient_substitution_verified_at_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ingredient-substitution-verified-at-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000c', 'Ingredient Substitution Verified At Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000c', 'c1111111-1111-4111-8111-11111111111c', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000090', 'c0000000-0000-4000-8000-00000000000c', 'Evidence Produce At', 'evidence produce at');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'c0000000-0000-4000-8000-000000000091', 'c0000000-0000-4000-8000-00000000000c',
    'Roma tomatoes', 'Produce', 'lb', 10, 20, 5, 2.5,
    'c0000000-0000-4000-8000-000000000090', 'Evidence Produce At',
    'g', 453.592, 'verified', now(), 'c1111111-1111-4111-8111-11111111111c'
  ),
  (
    'c0000000-0000-4000-8000-000000000092', 'c0000000-0000-4000-8000-00000000000c',
    'San Marzano tomatoes', 'Produce', 'lb', 8, 16, 4, 3.0,
    'c0000000-0000-4000-8000-000000000090', 'Evidence Produce At',
    'g', 453.592, 'verified', now(), 'c1111111-1111-4111-8111-11111111111c'
  );

select has_function(
  'private',
  'enforce_ingredient_substitution_verified_at_evidence',
  'ingredient substitution verified_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.ingredient_substitutions (
      restaurant_id, source_inventory_item_id, substitute_inventory_item_id,
      source_quantity, substitute_quantity, canonical_unit,
      verification_status, verified_at, verified_by
    ) values (
      'c0000000-0000-4000-8000-00000000000c',
      'c0000000-0000-4000-8000-000000000091',
      'c0000000-0000-4000-8000-000000000092',
      1, 1, 'g',
      'verified', null, 'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  'Ingredient substitution verification time is required',
  'direct ingredient_substitutions insert cannot mint verified status without verified_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.ingredient_substitutions (
      id, restaurant_id, source_inventory_item_id, substitute_inventory_item_id,
      source_quantity, substitute_quantity, canonical_unit,
      verification_status, verified_at, verified_by
    ) values (
      'c0000000-0000-4000-8000-0000000000aa',
      'c0000000-0000-4000-8000-00000000000c',
      'c0000000-0000-4000-8000-000000000091',
      'c0000000-0000-4000-8000-000000000092',
      1, 1, 'g',
      'verified', '2024-01-02T00:00:00Z'::timestamptz,
      'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  null,
  'direct ingredient_substitutions insert with verified_at remains allowed for verified status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.ingredient_substitutions (
      id, restaurant_id, source_inventory_item_id, substitute_inventory_item_id,
      source_quantity, substitute_quantity, canonical_unit,
      verification_status
    ) values (
      'c0000000-0000-4000-8000-0000000000ab',
      'c0000000-0000-4000-8000-00000000000c',
      'c0000000-0000-4000-8000-000000000091',
      'c0000000-0000-4000-8000-000000000092',
      2, 2, 'g',
      'draft'
    )
  $sql$),
  null,
  'direct ingredient_substitutions insert can open draft without verified_at'
);

select is(
  pg_temp.error_of($sql$
    update public.ingredient_substitutions
    set verification_status = 'verified',
      verified_at = clock_timestamp(),
      verified_by = 'c1111111-1111-4111-8111-11111111111c',
      updated_at = clock_timestamp()
    where id = 'c0000000-0000-4000-8000-0000000000ab'
  $sql$),
  null,
  'verification UPDATE with verified_at remains allowed (INSERT-only tip)'
);

select is(
  (
    select (verified_at is not null)
    from public.ingredient_substitutions
    where id = 'c0000000-0000-4000-8000-0000000000ab'
  ),
  true,
  'verification UPDATE keeps the stamped verified_at'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'c1111111-1111-4111-8111-11111111111c'
  $sql$),
  null,
  'account deletion remains allowed after ingredient_substitutions verification history exists'
);

select is(
  (
    select count(*)
    from public.ingredient_substitutions
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
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
    from public.ingredient_substitutions
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and id = 'c0000000-0000-4000-8000-0000000000aa'
      and source_quantity = 1
      and substitute_quantity = 1
      and canonical_unit = 'g'
  ),
  1::bigint,
  'account deletion preserves immutable ingredient_substitutions business fields'
);

select * from finish();
rollback;
