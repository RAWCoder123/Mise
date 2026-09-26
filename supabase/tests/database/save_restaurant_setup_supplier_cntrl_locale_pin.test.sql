-- MISE-005W: save_restaurant_setup supplier discovery display_name / email
-- cntrl + mailbox shape + email lower must use COLLATE "C" so day-0 setup
-- cannot accept supplier bytes a restored C-locale suppliers /
-- supplier_recipients CHECK would reject after locale drift (and vice versa).
begin;
select plan(4);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'save_restaurant_setup'
      and pg_get_function_identity_arguments(oid) =
        'uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer'
  ),
  'public.save_restaurant_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer) exists'
);

select matches(
  pg_get_functiondef(
    'public.save_restaurant_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer)'::regprocedure
  ),
  'coalesce\(payload\.display_name, ''''\) collate "C" ~ ''\[\[:cntrl:\]\]''',
  'save_restaurant_setup supplier discovery display_name cntrl uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'public.save_restaurant_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer)'::regprocedure
  ),
  'payload\.email collate "C" ~ ''\[\[:cntrl:\]\]''',
  'save_restaurant_setup supplier discovery email cntrl uses COLLATE C'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.save_restaurant_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on save_restaurant_setup'
);

select * from finish();
rollback;
