-- MISE-005BA: pin private.environment_identity.staging_marker shape CHECK and
-- verify_staging_identity gate to COLLATE "C".
--
-- private.environment_identity still stores staging_marker under a length-only
-- bound from the bound-resources migration:
--   length(staging_marker) between 16 and 200
-- public.verify_staging_identity mirrors that with the same length-only gate
-- before comparing the caller-supplied marker to the singleton row.
--
-- staging_marker is the non-secret environment identity that keeps disposable
-- staging scripts from aiming trusted credentials at production. It is the
-- only anonymous Data API callable comparison surface
-- (public.verify_staging_identity). Authenticated clients hold no table access;
-- the singleton row is service/operator configured.
--
-- POSIX character classes and collation follow database LC_CTYPE. This cluster
-- runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; later
-- 005* tips pinned Square merchant_id (#460) and OAuth state hashes (#438),
-- but left staging_marker on length-only bounds because no ASCII allowlist
-- existed yet for the preflight client or the RPC.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept a
-- marker the restored C-locale ASCII gate would refuse (or the reverse),
-- breaking staging preflight continuity and the production-aim fail-closed
-- guarantee across restore.
--
-- Scope:
--   - Replace length-only staging_marker CHECK with named shape CHECK:
--     staging_marker collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'
--   - Rewrite public.verify_staging_identity to the same COLLATE "C" class
--   - Preserve existing anon + authenticated EXECUTE (CREATE OR REPLACE keeps
--     grants; do not re-emit the anon grant — security.test deepEquals a
--     single anon grant statement across the migration corpus)
-- Does NOT rewrite Square merchant_id (#460), Gmail sender_email (#423),
-- OAuth state_hash/PKCE (#438), activity_events, restaurant_memories, or
-- inventory_events (#375).
-- Timestamp after MISE-005AZ (#460).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.environment_identity'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'environment_identity_staging_marker_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%staging_marker%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(staging_marker)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9._-]{16,200}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.environment_identity drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.environment_identity
  drop constraint if exists environment_identity_staging_marker_check;

alter table private.environment_identity
  add constraint environment_identity_staging_marker_check check (
    staging_marker collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'
  );

comment on constraint environment_identity_staging_marker_check
  on private.environment_identity is
  'MISE-005BA: ASCII staging_marker under COLLATE "C".';

create or replace function public.verify_staging_identity(p_expected_marker text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_expected_marker is not null
    and p_expected_marker collate "C" ~ '^[A-Za-z0-9._-]{16,200}$'
    and exists (
      select 1 from private.environment_identity identity_row
      where identity_row.singleton and identity_row.staging_marker = p_expected_marker
    );
$$;

comment on function public.verify_staging_identity(text) is
  'MISE-005BA: compare caller marker to staging identity under COLLATE "C" ASCII shape; anon/authenticated EXECUTE preserved from bound-resources migration.';
