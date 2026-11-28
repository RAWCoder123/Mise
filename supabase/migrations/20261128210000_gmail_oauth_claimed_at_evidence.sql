-- Gmail OAuth flow inserts that claim completion must carry claimed_at.
--
-- `private.gmail_oauth_flows.claimed_at` is nullable because open flows and
-- pre-claim failures legitimately leave it null. Soft table constraints only
-- forbid completed_at and failed_at together; they do not require claimed_at
-- when completed_at is set. Hosted service_complete_gmail_oauth requires an
-- already-claimed flow before stamping completed_at on UPDATE. Hosted
-- service_fail_gmail_oauth may fail an unclaimed flow and must remain
-- allowed.
--
-- Client and service_role DML are revoked; SECURITY DEFINER / direct INSERT
-- paths still reach the table. Begin writers INSERT open flows with
-- claimed_at and completed_at null until later claim / complete UPDATEs.
--
-- This migration fails closed at the database boundary for every INSERT when
-- completed_at is already set and claimed_at is null. Open / failed inserts
-- and claim / complete UPDATEs remain allowed — there is intentionally no
-- NOT NULL / completed-implies-claimed CHECK, because a CHECK would expand
-- beyond this INSERT-only tip boundary.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite Gmail OAuth begin / claim / complete / fail writers.
-- History is never rewritten. Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1329, including the sibling Gmail OAuth
-- failure-evidence tip (#1325). Soft contested merge with #1325's
-- completed_at-without-failure fixture (must stamp claimed_at when both land).

create or replace function private.enforce_gmail_oauth_claimed_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.completed_at is not null
    and new.claimed_at is null
  then
    raise exception
      'Gmail OAuth claim time evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists gmail_oauth_flows_claimed_at_evidence
  on private.gmail_oauth_flows;
create trigger gmail_oauth_flows_claimed_at_evidence
before insert on private.gmail_oauth_flows
for each row execute function private.enforce_gmail_oauth_claimed_at_evidence();

revoke all on function private.enforce_gmail_oauth_claimed_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_gmail_oauth_claimed_at_evidence() is
  'Fail closed: gmail_oauth_flows INSERT requires claimed_at when completed_at is set. Open/failed inserts and claim/complete UPDATEs remain permitted.';
