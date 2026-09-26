-- MISE-005AC: restaurant logo_url HTTPS host class must use COLLATE "C"
-- so restore CHECKs and profile-patch preflights cannot diverge under
-- locale drift.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_logo_url_check'
  ),
  'restaurants_logo_url_check exists'
);

select matches(
  pg_get_constraintdef(
    (
      select oid
      from pg_constraint
      where conrelid = 'public.restaurants'::regclass
        and conname = 'restaurants_logo_url_check'
    )
  ),
  'logo_url collate "C" ~\*',
  'restaurants logo_url CHECK uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.update_restaurant_profile(uuid, jsonb)'::regprocedure
  ),
  'next_logo_url collate "C" !~\*',
  'profile logo_url patch gate uses COLLATE C'
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

select ok(
  pg_get_constraintdef(
    (
      select oid
      from pg_constraint
      where conrelid = 'public.restaurants'::regclass
        and conname = 'restaurants_logo_url_check'
    )
  ) ~ '\[\^\[:space:\]\]',
  'restaurants logo_url CHECK retains ASCII space class'
);

select * from finish();
rollback;
