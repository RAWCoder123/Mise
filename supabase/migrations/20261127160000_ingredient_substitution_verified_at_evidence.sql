-- Ingredient-substitution inserts that claim verified status must carry
-- verified_at.
--
-- `public.ingredient_substitutions.verified_at` is nullable so draft /
-- rejected / expired rows legitimately leave it null until a later
-- verification UPDATE stamps the timestamp. Account-deletion anonymization
-- clears only verified_by via ON DELETE SET NULL and preserves verified_at,
-- so verification history remains time-attributable after the operator
-- identity is removed.
--
-- Writers normally INSERT draft substitutions and only later UPDATE into
-- verification_status = 'verified' with a stamped verified_at, but any INSERT
-- that reaches the table can still mint a verified claim with verified_at
-- null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when verification_status is already
-- 'verified' and verified_at is null. Verification UPDATEs and draft inserts
-- remain allowed — there is intentionally no NOT NULL /
-- status-implies-timestamp CHECK, so this tip stays INSERT-only and
-- orthogonal to the companion verified_by actor tip.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite any verify writer. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_ingredient_substitution_verified_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.verification_status = 'verified'
    and new.verified_at is null
  then
    raise exception
      'Ingredient substitution verification time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists ingredient_substitutions_verified_at_evidence
  on public.ingredient_substitutions;
create trigger ingredient_substitutions_verified_at_evidence
before insert on public.ingredient_substitutions
for each row execute function private.enforce_ingredient_substitution_verified_at_evidence();

revoke all on function private.enforce_ingredient_substitution_verified_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_ingredient_substitution_verified_at_evidence() is
  'Fail closed: ingredient_substitutions INSERT requires a non-null verified_at when verification_status is verified. Draft inserts and verification UPDATEs remain permitted.';
