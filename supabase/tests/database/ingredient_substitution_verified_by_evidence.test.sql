create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' ingredient_substitution_verified_by_evidence.test.sql
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
  ('b1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ingredient-substitution-verified-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('b0000000-0000-4000-8000-00000000000a', 'Ingredient Substitution Verified By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('b0000000-0000-4000-8000-00000000000a', 'b1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('b0000000-0000-4000-8000-000000000090', 'b0000000-0000-4000-8000-00000000000a', 'Evidence Produce', 'evidence produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'b0000000-0000-4000-8000-000000000091', 'b0000000-0000-4000-8000-00000000000a',
    'Roma tomatoes', 'Produce', 'lb', 10, 20, 5, 2.5,
    'b0000000-0000-4000-8000-000000000090', 'Evidence Produce',
    'g', 453.592, 'verified', now(), 'b1111111-1111-4111-8111-11111111111a'
  ),
  (
    'b0000000-0000-4000-8000-000000000092', 'b0000000-0000-4000-8000-00000000000a',
    'San Marzano tomatoes', 'Produce', 'lb', 8, 16, 4, 3.0,
    'b0000000-0000-4000-8000-000000000090', 'Evidence Produce',
    'g', 453.592, 'verified', now(), 'b1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_ingredient_substitution_verified_by_evidence',
  'ingredient substitution verified_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.ingredient_substitutions (
      restaurant_id, source_inventory_item_id, substitute_inventory_item_id,
      source_quantity, substitute_quantity, canonical_unit,
      verification_status, verified_at, verified_by
    ) values (
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'b0000000-0000-4000-8000-000000000092',
      1, 1, 'g',
      'verified', now(), null
    )
  $sql$),
  'Ingredient substitution verifier is required',
  'direct ingredient_substitutions insert cannot mint verified status without verified_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.ingredient_substitutions (
      id, restaurant_id, source_inventory_item_id, substitute_inventory_item_id,
      source_quantity, substitute_quantity, canonical_unit,
      verification_status, verified_at, verified_by
    ) values (
      'b0000000-0000-4000-8000-0000000000aa',
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'b0000000-0000-4000-8000-000000000092',
      1, 1, 'g',
      'verified', now(), 'b1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct ingredient_substitutions insert with verified_by remains allowed for verified status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.ingredient_substitutions (
      id, restaurant_id, source_inventory_item_id, substitute_inventory_item_id,
      source_quantity, substitute_quantity, canonical_unit,
      verification_status
    ) values (
      'b0000000-0000-4000-8000-0000000000ab',
      'b0000000-0000-4000-8000-00000000000a',
      'b0000000-0000-4000-8000-000000000091',
      'b0000000-0000-4000-8000-000000000092',
      2, 2, 'g',
      'draft'
    )
  $sql$),
  null,
  'direct ingredient_substitutions insert can open draft without verified_by'
);

select is(
  pg_temp.error_of($sql$
    update public.ingredient_substitutions
    set verification_status = 'verified',
      verified_at = clock_timestamp(),
      verified_by = 'b1111111-1111-4111-8111-11111111111a',
      updated_at = clock_timestamp()
    where id = 'b0000000-0000-4000-8000-0000000000ab'
  $sql$),
  null,
  'verification UPDATE with actor remains allowed (INSERT-only tip)'
);

select is(
  (
    select verified_by
    from public.ingredient_substitutions
    where id = 'b0000000-0000-4000-8000-0000000000ab'
  ),
  'b1111111-1111-4111-8111-11111111111a'::uuid,
  'verification UPDATE keeps the stamped verified_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'b1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after ingredient_substitutions verification history exists'
);

select is(
  (
    select count(*)
    from public.ingredient_substitutions
    where restaurant_id = 'b0000000-0000-4000-8000-00000000000a'
      and id = 'b0000000-0000-4000-8000-0000000000aa'
      and verified_by is null
      and verification_status = 'verified'
  ),
  1::bigint,
  'account deletion anonymizes verified_by without rewriting verification status'
);

select is(
  (
    select count(*)
    from public.ingredient_substitutions
    where restaurant_id = 'b0000000-0000-4000-8000-00000000000a'
      and id = 'b0000000-0000-4000-8000-0000000000aa'
      and source_quantity = 1
      and substitute_quantity = 1
      and canonical_unit = 'g'
  ),
  1::bigint,
  'account deletion preserves immutable ingredient_substitutions business fields'
);

select * from finish();
rollback;
