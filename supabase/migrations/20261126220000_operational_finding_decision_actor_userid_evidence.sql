-- Operational finding-decision inserts must carry an actor_user_id.
--
-- `public.operational_finding_decisions.actor_user_id` is nullable so account
-- deletion anonymization can clear only the deleted operator's auth identity
-- while preserving append-only business fields (ON DELETE SET NULL + the
-- append-only UPDATE escape in
-- private.reject_operational_finding_decision_mutation).
-- Hosted public.record_operational_finding_decision stamps auth.uid(), but any
-- insert path that reaches the table can still mint an unattributable
-- approve, edit, or dismiss row with actor_user_id null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when actor_user_id is null.
-- Account-deletion anonymization UPDATEs remain allowed — there is
-- intentionally no NOT NULL CHECK, because a CHECK would block the
-- ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, RLS, and append-only
-- behavior stay in place. Does not rewrite
-- record_operational_finding_decision or
-- reject_operational_finding_decision_mutation. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_operational_finding_decision_actor_userid_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.actor_user_id is null then
    raise exception
      'Operational finding decision actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists operational_finding_decisions_actor_userid_evidence
  on public.operational_finding_decisions;
create trigger operational_finding_decisions_actor_userid_evidence
before insert on public.operational_finding_decisions
for each row execute function private.enforce_operational_finding_decision_actor_userid_evidence();

revoke all on function private.enforce_operational_finding_decision_actor_userid_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_operational_finding_decision_actor_userid_evidence() is
  'Fail closed: operational_finding_decisions INSERT requires a non-null actor_user_id. Account-deletion anonymization UPDATEs remain permitted.';
