create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' recipe_confirmed_by_evidence.test.sql
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
  ('a1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'recipe-confirmed-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-00000000000a', 'Recipe Confirmed By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-11111111111a', 'manager', 'active');

select has_function(
  'private',
  'enforce_recipe_confirmed_by_evidence',
  'recipe confirmed by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.menu_items (
      restaurant_id, name, category, active,
      recipe_revision, recipe_confirmed_revision, recipe_confirmed_at
    ) values (
      'a0000000-0000-4000-8000-00000000000a',
      'Null Confirmer Probe', 'Mains', true,
      0, 0, clock_timestamp()
    )
  $sql$),
  'Recipe confirmation actor is required',
  'direct menu_items insert cannot mint confirmed recipe without recipe_confirmed_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.menu_items (
      id, restaurant_id, name, category, active,
      recipe_revision, recipe_confirmed_revision, recipe_confirmed_at,
      recipe_confirmed_by
    ) values (
      'a0000000-0000-4000-8000-0000000000aa',
      'a0000000-0000-4000-8000-00000000000a',
      'Attributed Confirmed Probe', 'Mains', true,
      0, 0, clock_timestamp(),
      'a1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct menu_items insert with recipe_confirmed_by remains allowed for confirmed recipe'
);

select is(
  pg_temp.error_of($sql$
    insert into public.menu_items (
      id, restaurant_id, name, category, active
    ) values (
      'a0000000-0000-4000-8000-0000000000ab',
      'a0000000-0000-4000-8000-00000000000a',
      'Unconfirmed Fixture', 'Mains', true
    )
  $sql$),
  null,
  'direct menu_items insert can open unconfirmed recipe without recipe_confirmed_by'
);

select is(
  pg_temp.error_of($sql$
    update public.menu_items
    set recipe_confirmed_revision = recipe_revision,
      recipe_confirmed_at = clock_timestamp(),
      recipe_confirmed_by = 'a1111111-1111-4111-8111-11111111111a',
      updated_at = clock_timestamp()
    where id = 'a0000000-0000-4000-8000-0000000000ab'
  $sql$),
  null,
  'confirmation UPDATE with actor remains allowed (INSERT-only tip)'
);

select is(
  (
    select recipe_confirmed_by
    from public.menu_items
    where id = 'a0000000-0000-4000-8000-0000000000ab'
  ),
  'a1111111-1111-4111-8111-11111111111a'::uuid,
  'confirmation UPDATE keeps the stamped recipe_confirmed_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'a1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after menu_items confirmation history exists'
);

select is(
  (
    select count(*)
    from public.menu_items
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and id = 'a0000000-0000-4000-8000-0000000000aa'
      and recipe_confirmed_by is null
      and recipe_confirmed_revision is not null
  ),
  1::bigint,
  'account deletion anonymizes confirmation actors without rewriting confirmation revision'
);

select is(
  (
    select count(*)
    from public.menu_items
    where restaurant_id = 'a0000000-0000-4000-8000-00000000000a'
      and id = 'a0000000-0000-4000-8000-0000000000aa'
      and name = 'Attributed Confirmed Probe'
      and recipe_confirmed_revision = 0
  ),
  1::bigint,
  'account deletion preserves immutable menu_items business fields'
);

select * from finish();
rollback;
