-- Ingredient-substitution inserts that claim verified status must carry
-- verified_by.
--
-- `public.ingredient_substitutions.verified_by` is nullable so account-
-- deletion anonymization can clear only the deleted operator's auth identity
-- while preserving the substitution's operational history
-- (ON DELETE SET NULL). Draft / rejected / expired rows legitimately leave
-- verified_by null.
--
-- Writers normally INSERT draft substitutions and only later UPDATE into
-- verification_status = 'verified' with a stamped actor, but any INSERT that
-- reaches the table can still mint a verified claim with verified_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when verification_status is already
-- 'verified' and verified_by is null. Account-deletion anonymization UPDATEs
-- remain allowed — there is intentionally no NOT NULL / status-implies-actor
-- CHECK, because a CHECK would block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite any verify writer. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_ingredient_substitution_verified_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.verification_status = 'verified'
    and new.verified_by is null
  then
    raise exception
      'Ingredient substitution verifier is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists ingredient_substitutions_verified_by_evidence
  on public.ingredient_substitutions;
create trigger ingredient_substitutions_verified_by_evidence
before insert on public.ingredient_substitutions
for each row execute function private.enforce_ingredient_substitution_verified_by_evidence();

revoke all on function private.enforce_ingredient_substitution_verified_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_ingredient_substitution_verified_by_evidence() is
  'Fail closed: ingredient_substitutions INSERT requires a non-null verified_by when verification_status is verified. Draft inserts and verification UPDATEs remain permitted.';
