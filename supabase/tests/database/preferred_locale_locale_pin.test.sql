-- MISE-005CB: users.preferred_locale CHECK and writer gate must keep
-- the exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a preference identity the restored C-locale
-- gate would refuse.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_preferred_locale_allowlist_check'
  ),
  'users_preferred_locale_allowlist_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_preferred_locale_allowlist_check'
  ),
  'preferred_locale in \(''en'', ''es'', ''zh-Hans''\)',
  'preferred_locale CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_preferred_locale_allowlist_check'
  ),
  'preferred_locale collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'preferred_locale CHECK uses COLLATE C'
);

select matches(
  pg_get_functiondef('public.update_my_preferred_locale(text)'::regprocedure),
  'p_locale collate "C" !~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'update_my_preferred_locale writer uses COLLATE C shape gate'
);

select matches(
  pg_get_functiondef('public.update_my_preferred_locale(text)'::regprocedure),
  'p_locale not in \(''en'', ''es'', ''zh-Hans''\)',
  'update_my_preferred_locale writer keeps exact allowlist'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('en' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token en matches under COLLATE C'
);

select is(
  ('es' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token es matches under COLLATE C'
);

select is(
  ('zh-Hans' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token zh-Hans matches under COLLATE C'
);

select is(
  ('zh Hans' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced preferred_locale token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty preferred_locale token is rejected under COLLATE C'
);

select is(
  ('zh-Hans!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated preferred_locale token is rejected under COLLATE C'
);

select is(
  (E'zh-Han\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII preferred_locale token is rejected under COLLATE C'
);

select is(
  ('en' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('es' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('zh-Hans' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted preferred_locale tokens match under COLLATE C'
);

select is(
  has_function_privilege('authenticated', 'public.update_my_preferred_locale(text)', 'EXECUTE'),
  true,
  'authenticated EXECUTE on update_my_preferred_locale is preserved'
);

select * from finish();
rollback;
