create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' recipe_version_verified_at_evidence.test.sql
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
  ('d1111111-1111-4111-8111-11111111111d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'recipe-version-verified-at-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-00000000000d', 'Recipe Version Verified At Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-00000000000d', 'd1111111-1111-4111-8111-11111111111d', 'manager', 'active');

insert into public.menu_items (id, restaurant_id, name, category, active) values
  (
    'd0000000-0000-4000-8000-000000000091',
    'd0000000-0000-4000-8000-00000000000d',
    'Time-Attributed Verified Dish',
    'Mains',
    true
  ),
  (
    'd0000000-0000-4000-8000-000000000092',
    'd0000000-0000-4000-8000-00000000000d',
    'Draft Then Verified Time Dish',
    'Mains',
    true
  );

select has_function(
  'private',
  'enforce_recipe_version_verified_at_evidence',
  'recipe version verified_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.recipe_versions (
      restaurant_id, menu_item_id, version_number, status,
      serving_quantity, prep_yield, cooking_yield, effective_from,
      verified_at, verified_by
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      1, 'verified',
      1, 1, 1, '2024-01-01T00:00:00Z'::timestamptz,
      null, 'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Recipe version verification time is required',
  'direct recipe_versions insert cannot mint verified status without verified_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.recipe_versions (
      id, restaurant_id, menu_item_id, version_number, status,
      serving_quantity, prep_yield, cooking_yield, effective_from,
      verified_at, verified_by
    ) values (
      'd0000000-0000-4000-8000-0000000000aa',
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      1, 'verified',
      1, 1, 1, '2024-01-01T00:00:00Z'::timestamptz,
      '2024-01-02T00:00:00Z'::timestamptz,
      'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  null,
  'direct recipe_versions insert with verified_at remains allowed for verified status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.recipe_versions (
      id, restaurant_id, menu_item_id, version_number, status,
      serving_quantity, prep_yield, cooking_yield, effective_from
    ) values (
      'd0000000-0000-4000-8000-0000000000ab',
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000092',
      1, 'draft',
      1, 1, 1, '2024-06-01T00:00:00Z'::timestamptz
    )
  $sql$),
  null,
  'direct recipe_versions insert can open draft without verified_at'
);

select is(
  pg_temp.error_of($sql$
    update public.recipe_versions
    set status = 'verified',
      verified_at = clock_timestamp(),
      verified_by = 'd1111111-1111-4111-8111-11111111111d',
      updated_at = clock_timestamp()
    where id = 'd0000000-0000-4000-8000-0000000000ab'
  $sql$),
  null,
  'verification UPDATE with verified_at remains allowed (INSERT-only tip)'
);

select is(
  (
    select (verified_at is not null)
    from public.recipe_versions
    where id = 'd0000000-0000-4000-8000-0000000000ab'
  ),
  true,
  'verification UPDATE keeps the stamped verified_at'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'd1111111-1111-4111-8111-11111111111d'
  $sql$),
  null,
  'account deletion remains allowed after recipe_versions verification history exists'
);

select is(
  (
    select count(*)
    from public.recipe_versions
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000d'
      and id = 'd0000000-0000-4000-8000-0000000000aa'
      and verified_by is null
      and verified_at is not null
      and status = 'verified'
  ),
  1::bigint,
  'account deletion anonymizes verified_by while preserving verified_at'
);

select is(
  (
    select count(*)
    from public.recipe_versions
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000d'
      and id = 'd0000000-0000-4000-8000-0000000000aa'
      and version_number = 1
      and serving_quantity = 1
      and menu_item_id = 'd0000000-0000-4000-8000-000000000091'
  ),
  1::bigint,
  'account deletion preserves immutable recipe_versions business fields'
);

select * from finish();
rollback;
