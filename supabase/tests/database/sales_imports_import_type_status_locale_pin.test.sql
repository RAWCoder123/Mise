-- MISE-005DD: sales_imports.import_type and status CHECKs must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an import-vocabulary identity the restored
-- C-locale gate would refuse.
begin;
select plan(18);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_import_type_check'
  ),
  'sales_imports_import_type_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_status_check'
  ),
  'sales_imports_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_import_type_check'
  ),
  'import_type in \(''pos_sync'', ''csv_upload'', ''manual_adjustment''\)',
  'sales_imports import_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_import_type_check'
  ),
  'import_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'sales_imports import_type CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_status_check'
  ),
  'status in \(''queued'', ''processing'', ''completed'', ''failed''\)',
  'sales_imports status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.sales_imports'::regclass
      and conname = 'sales_imports_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'sales_imports status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('pos_sync' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token pos_sync matches under COLLATE C'
);

select is(
  ('csv_upload' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token csv_upload matches under COLLATE C'
);

select is(
  ('manual_adjustment' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manual_adjustment matches under COLLATE C'
);

select is(
  ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token queued matches under COLLATE C'
);

select is(
  ('processing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token processing matches under COLLATE C'
);

select is(
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token failed matches under COLLATE C'
);

select is(
  ('pos sync' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced import_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty import vocabulary token is rejected under COLLATE C'
);

select is(
  ('failed!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'fail\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('pos_sync' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('csv_upload' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manual_adjustment' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('processing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted import_type and status tokens match under COLLATE C'
);

select * from finish();
rollback;
