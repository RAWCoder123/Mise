-- MISE-005EE: setup_attachments.kind and status CHECKs must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a setup-attachment vocabulary identity the
-- restored C-locale gate would refuse.
begin;
select plan(17);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_kind_check'
  ),
  'setup_attachments_kind_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_status_check'
  ),
  'setup_attachments_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_kind_check'
  ),
  'kind in \(''csv'', ''screenshot''\)',
  'setup_attachments kind CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_kind_check'
  ),
  'kind collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'setup_attachments kind CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_status_check'
  ),
  'status in \(''queued'', ''review_needed'', ''processed'', ''dismissed''\)',
  'setup_attachments status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.setup_attachments'::regclass
      and conname = 'setup_attachments_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'setup_attachments status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('csv' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token csv matches under COLLATE C'
);

select is(
  ('screenshot' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token screenshot matches under COLLATE C'
);

select is(
  ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token queued matches under COLLATE C'
);

select is(
  ('review_needed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token review_needed matches under COLLATE C'
);

select is(
  ('processed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token processed matches under COLLATE C'
);

select is(
  ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token dismissed matches under COLLATE C'
);

select is(
  ('review needed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty setup attachment vocabulary token is rejected under COLLATE C'
);

select is(
  ('dismissed!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'dismiss\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('csv' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('screenshot' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('review_needed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('processed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted kind and status tokens match under COLLATE C'
);

select * from finish();
rollback;
