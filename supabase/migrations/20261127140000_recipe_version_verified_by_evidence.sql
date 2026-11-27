-- Recipe-version inserts that claim verified status must carry verified_by.
--
-- `public.recipe_versions.verified_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the recipe version's operational history (ON DELETE SET NULL).
-- Draft / retired rows legitimately leave verified_by null.
--
-- Writers may INSERT draft recipe versions and only later UPDATE into
-- status = 'verified' with a stamped actor, but any INSERT that reaches the
-- table can still mint a verified claim with verified_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is already 'verified' and
-- verified_by is null. Account-deletion anonymization UPDATEs remain allowed —
-- there is intentionally no NOT NULL / status-implies-actor CHECK, because a
-- CHECK would block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite any verify writer. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_recipe_version_verified_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'verified'
    and new.verified_by is null
  then
    raise exception
      'Recipe version verifier is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists recipe_versions_verified_by_evidence
  on public.recipe_versions;
create trigger recipe_versions_verified_by_evidence
before insert on public.recipe_versions
for each row execute function private.enforce_recipe_version_verified_by_evidence();

revoke all on function private.enforce_recipe_version_verified_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_recipe_version_verified_by_evidence() is
  'Fail closed: recipe_versions INSERT requires a non-null verified_by when status is verified. Draft inserts and verification UPDATEs remain permitted.';
