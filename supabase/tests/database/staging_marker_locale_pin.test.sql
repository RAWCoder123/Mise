-- MISE-005BA: private.environment_identity.staging_marker CHECK must use
-- COLLATE "C" so dump/restore cannot accept a marker the restored ASCII
-- C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.environment_identity'::regclass
      and conname = 'environment_identity_staging_marker_check'
  ),
  'environment_identity_staging_marker_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.environment_identity'::regclass
      and conname = 'environment_identity_staging_marker_check'
  ),
  'staging_marker collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{16,200\}\$''',
  'environment_identity staging_marker CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length(staging_marker)%'
    from pg_constraint
    where conrelid = 'private.environment_identity'::regclass
      and conname = 'environment_identity_staging_marker_check'
  ),
  true,
  'environment_identity staging_marker CHECK is not length-only'
);

select matches(
  pg_get_functiondef('public.verify_staging_identity(text)'::regprocedure),
  'p_expected_marker collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{16,200\}\$''',
  'verify_staging_identity marker gate uses COLLATE C'
);

select is(
  (
    pg_get_functiondef(
      'public.verify_staging_identity(text)'::regprocedure
    ) not ilike '%length(coalesce(p_expected_marker%'
  ),
  true,
  'verify_staging_identity marker gate is not length-only'
);

select is(
  has_function_privilege('anon', 'public.verify_staging_identity(text)', 'execute'),
  true,
  'anon retains EXECUTE on verify_staging_identity'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.verify_staging_identity(text)',
    'execute'
  ),
  true,
  'authenticated retains EXECUTE on verify_staging_identity'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and mint-focused.
select is(
  ('mise-staging-marker-2026' collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'),
  true,
  'fixture-shaped staging_marker matches under COLLATE C'
);

select is(
  ('mise_staging.marker-01' collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'),
  true,
  'underscore/dot/hyphen staging_marker matches under COLLATE C'
);

select is(
  ('mise staging marker!!' collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'),
  false,
  'spaced/punct staging_marker is rejected under COLLATE C'
);

select is(
  ('mise-staging-café-2026' collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'),
  false,
  'non-ASCII staging_marker is rejected under COLLATE C'
);

select is(
  ('short-marker-1' collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'),
  false,
  'under-length staging_marker is rejected under COLLATE C'
);

select * from finish();
rollback;
