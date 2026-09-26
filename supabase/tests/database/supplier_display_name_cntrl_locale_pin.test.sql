-- MISE-005V: create_supplier / rename_supplier display_name cntrl preflights
-- must use COLLATE "C" so mutators cannot accept display_name bytes a restored
-- C-locale suppliers_display_name_check would reject after locale drift (and
-- vice versa).
begin;
select plan(5);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'create_supplier'
      and pg_get_function_identity_arguments(oid) = 'uuid, text'
  )
  and exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'rename_supplier'
      and pg_get_function_identity_arguments(oid) = 'uuid, uuid, text'
  ),
  'public.create_supplier(uuid, text) and public.rename_supplier(uuid, uuid, text) exist'
);

select matches(
  pg_get_functiondef('public.create_supplier(uuid, text)'::regprocedure),
  'coalesce\(p_display_name, ''''\) collate "C" ~ ''\[\[:cntrl:\]\]''',
  'create_supplier display_name cntrl preflight uses COLLATE C'
);

select matches(
  pg_get_functiondef('public.rename_supplier(uuid, uuid, text)'::regprocedure),
  'coalesce\(p_display_name, ''''\) collate "C" ~ ''\[\[:cntrl:\]\]''',
  'rename_supplier display_name cntrl preflight uses COLLATE C'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.create_supplier(uuid, text)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on create_supplier'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.rename_supplier(uuid, uuid, text)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on rename_supplier'
);

select * from finish();
rollback;
