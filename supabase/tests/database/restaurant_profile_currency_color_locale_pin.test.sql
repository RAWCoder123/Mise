-- MISE-005AB: restaurant currency + brand/accent hex shape must use
-- COLLATE "C" so restore CHECKs and profile-patch preflights cannot diverge
-- under locale drift.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_currency_code_check'
  ),
  'restaurants_currency_code_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_brand_color_check'
  ),
  'restaurants_brand_color_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_accent_color_check'
  ),
  'restaurants_accent_color_check exists'
);

select matches(
  pg_get_constraintdef(
    (
      select oid
      from pg_constraint
      where conrelid = 'public.restaurants'::regclass
        and conname = 'restaurants_currency_code_check'
    )
  ),
  'currency collate "C" ~ ''\^\[A-Z\]\{3\}\$''',
  'restaurants currency CHECK uses COLLATE C'
);

select matches(
  pg_get_constraintdef(
    (
      select oid
      from pg_constraint
      where conrelid = 'public.restaurants'::regclass
        and conname = 'restaurants_brand_color_check'
    )
  ),
  'brand_color collate "C" ~ ''\^#\[0-9A-Fa-f\]\{6\}\$''',
  'restaurants brand_color CHECK uses COLLATE C'
);

select matches(
  pg_get_constraintdef(
    (
      select oid
      from pg_constraint
      where conrelid = 'public.restaurants'::regclass
        and conname = 'restaurants_accent_color_check'
    )
  ),
  'accent_color collate "C" ~ ''\^#\[0-9A-Fa-f\]\{6\}\$''',
  'restaurants accent_color CHECK uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.update_restaurant_profile(uuid, jsonb)'::regprocedure
  ),
  '\(p_patch ->> ''brand_color''\) collate "C" !~ ''\^#\[0-9A-Fa-f\]\{6\}\$''',
  'profile brand_color patch gate uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.update_restaurant_profile(uuid, jsonb)'::regprocedure
  ),
  '\(p_patch ->> ''accent_color''\) collate "C" !~ ''\^#\[0-9A-Fa-f\]\{6\}\$''',
  'profile accent_color patch gate uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.update_restaurant_profile(uuid, jsonb)'::regprocedure
  ),
  '\(p_patch ->> ''currency''\) collate "C" !~ ''\^\[A-Z\]\{3\}\$''',
  'profile currency patch gate uses COLLATE C'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.update_restaurant_profile(uuid, jsonb)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on public.update_restaurant_profile'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.update_restaurant_profile(uuid, jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on private.update_restaurant_profile'
);

select * from finish();
rollback;
