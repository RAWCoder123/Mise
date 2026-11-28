-- Square OAuth flow inserts that claim failure must carry failure_code.
--
-- `private.square_oauth_flows.failure_code` is nullable because open flows
-- (no failed_at) and successful completions (completed_at) legitimately leave
-- it null. Hosted service_fail_square_oauth already stamps a bounded slug into
-- failure_code when UPDATEing failed_at, but any INSERT that reaches the table
-- can still mint a failed flow with failure_code null or blank after trim.
--
-- Client and service_role DML are revoked; SECURITY DEFINER / direct INSERT
-- paths still reach the table. Begin writers INSERT open flows with failed_at
-- null until a later fail path stamps evidence.
--
-- This migration fails closed at the database boundary for every INSERT when
-- failed_at is already set and failure_code is null/blank after trim. Open /
-- completed inserts and failure UPDATEs remain allowed — there is intentionally
-- no NOT NULL / failed_at-implies-code CHECK, because a CHECK would block
-- legitimate open and completed rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite Square OAuth begin / fail / complete writers. History is
-- never rewritten. Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1323 and mise_actions failure evidence (#1305).

create or replace function private.enforce_square_oauth_failure_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.failed_at is not null
    and nullif(btrim(new.failure_code), '') is null
  then
    raise exception
      'Square OAuth failure evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists square_oauth_flows_failure_evidence
  on private.square_oauth_flows;
create trigger square_oauth_flows_failure_evidence
before insert on private.square_oauth_flows
for each row execute function private.enforce_square_oauth_failure_evidence();

revoke all on function private.enforce_square_oauth_failure_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_square_oauth_failure_evidence() is
  'Fail closed: square_oauth_flows INSERT requires a non-empty failure_code when failed_at is set. Open/completed inserts and failure UPDATEs remain permitted.';
