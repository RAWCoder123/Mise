-- MISE-005AA: find_restaurant_member_candidate email normalize/compare must
-- use COLLATE "C" so membership invite lookup cannot diverge under locale drift.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'find_restaurant_member_candidate'
      and pg_get_function_identity_arguments(oid) = 'uuid, text'
  ),
  'public.find_restaurant_member_candidate(uuid, text) exists'
);

select matches(
  pg_get_functiondef(
    'public.find_restaurant_member_candidate(uuid, text)'::regprocedure
  ),
  'pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_email, ''''\)\) collate "C"\s*\) collate "C"',
  'candidate email normalize uses COLLATE C lower/btrim'
);

select matches(
  pg_get_functiondef(
    'public.find_restaurant_member_candidate(uuid, text)'::regprocedure
  ),
  'normalized_email collate "C" !~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'candidate email shape check uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'public.find_restaurant_member_candidate(uuid, text)'::regprocedure
  ),
  'pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(auth_user\.email::text, ''''\)\) collate "C"\s*\) collate "C" = normalized_email',
  'candidate Auth email compare uses COLLATE C'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.find_restaurant_member_candidate(uuid, text)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on find_restaurant_member_candidate'
);

select is(
  has_function_privilege(
    'anon',
    'public.find_restaurant_member_candidate(uuid, text)',
    'EXECUTE'
  ),
  false,
  'anon lacks EXECUTE on find_restaurant_member_candidate'
);

select * from finish();
rollback;
