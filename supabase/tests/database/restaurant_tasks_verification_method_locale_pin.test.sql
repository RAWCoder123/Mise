-- MISE-005CR: restaurant_tasks.verification_method CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a verification-method identity the restored
-- C-locale gate would refuse.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_verification_method_check'
  ),
  'restaurant_tasks_verification_method_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_verification_method_check'
  ),
  'verification_method in \(''none'', ''checklist'', ''photo'', ''count'', ''receipt'', ''manager_review'', ''source_state''\)',
  'restaurant_tasks verification_method CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_verification_method_check'
  ),
  'verification_method collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks verification_method CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('none' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token none matches under COLLATE C'
);

select is(
  ('checklist' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token checklist matches under COLLATE C'
);

select is(
  ('photo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token photo matches under COLLATE C'
);

select is(
  ('count' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token count matches under COLLATE C'
);

select is(
  ('receipt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token receipt matches under COLLATE C'
);

select is(
  ('manager_review' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manager_review matches under COLLATE C'
);

select is(
  ('source_state' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token source_state matches under COLLATE C'
);

select is(
  ('man ager_review' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced verification_method token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty verification_method token is rejected under COLLATE C'
);

select is(
  ('checklist!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated verification_method token is rejected under COLLATE C'
);

select is(
  (E'checkl\u00f6st' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII verification_method token is rejected under COLLATE C'
);

select is(
  ('none' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('checklist' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('photo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('count' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('receipt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manager_review' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('source_state' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted verification_method tokens match under COLLATE C'
);

select * from finish();
rollback;
