-- MISE-005CI: inventory_count_sessions.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a lifecycle-state identity the restored
-- C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_status_check'
  ),
  'inventory_count_sessions_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_status_check'
  ),
  'status in \(''in_progress'', ''submitted'', ''approved'', ''cancelled''\)',
  'inventory_count_sessions status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_count_sessions'::regclass
      and conname = 'inventory_count_sessions_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'inventory_count_sessions status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('in_progress' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token in_progress matches under COLLATE C'
);

select is(
  ('submitted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token submitted matches under COLLATE C'
);

select is(
  ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approved matches under COLLATE C'
);

select is(
  ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cancelled matches under COLLATE C'
);

select is(
  ('in progress' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('approved!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'cancell\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('in_progress' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('submitted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
