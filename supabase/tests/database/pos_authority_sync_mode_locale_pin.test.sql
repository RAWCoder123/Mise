-- MISE-005EI: public.pos_integrations.authority_sync_mode CHECK inside
-- pos_integrations_authority_sync_state_check must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept a sync-mode vocabulary token the restored C-locale gate would
-- refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_authority_sync_state_check'
  ),
  'pos_integrations_authority_sync_state_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_authority_sync_state_check'
  ),
  'authority_sync_mode in \(''full'', ''partial''\)',
  'pos_integrations authority_sync_mode CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_authority_sync_state_check'
  ),
  'authority_sync_mode collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'pos_integrations authority_sync_mode CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('full' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token full matches under COLLATE C'
);

select is(
  ('partial' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token partial matches under COLLATE C'
);

select is(
  ('par tial' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced authority_sync_mode token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty authority_sync_mode token is rejected under COLLATE C'
);

select is(
  ('partial!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated authority_sync_mode token is rejected under COLLATE C'
);

select is(
  (E'part\u00efal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII authority_sync_mode token is rejected under COLLATE C'
);

select is(
  ('full' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('partial' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted authority_sync_mode tokens match under COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_authority_sync_state_check'
  ),
  'authority_sync_token is null',
  'pos_integrations authority sync state CHECK keeps idle-all-null branch'
);

select * from finish();
rollback;
