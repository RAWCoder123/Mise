-- Inventory count-session inserts that claim a terminal workflow status must
-- carry the matching workflow actor.
--
-- Soft CHECKs already require submitted_at / approved_at / cancelled_at when
-- status is submitted / approved / cancelled, but they do not require
-- submitted_by / approved_by / cancelled_by. Those columns stay nullable so
-- account-deletion anonymization can clear only the deleted operator's auth
-- identity (ON DELETE SET NULL). Hosted submit / approve / cancel RPCs stamp
-- p_actor_user_id via UPDATE, but any INSERT that reaches the table can still
-- mint a terminal-status session with a matching timestamp and a null workflow
-- actor.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status claims a workflow step
-- without the matching actor. Account-deletion anonymization UPDATEs remain
-- allowed — there is intentionally no NOT NULL / status-implies-actor CHECK,
-- because a CHECK would block the ON DELETE SET NULL escape.
--
-- in_progress inserts do not require submitted_by / approved_by / cancelled_by
-- (those are stamped by later workflow steps). Soft CHECKs, FKs, grants/
-- revokes, tenant isolation, and RLS stay in place. Does not rewrite
-- service_begin / submit / approve / cancel writers. History is never
-- rewritten. Nothing is relaxed.
-- Contested merge: #1295 attributed cancelled fixture needs cancelled_by.

create or replace function private.enforce_inventory_count_session_workflow_actor_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'submitted' and new.submitted_by is null then
    raise exception
      'Inventory count session submitter is required'
      using errcode = '22023';
  end if;

  if new.status = 'approved' and new.approved_by is null then
    raise exception
      'Inventory count session approver is required'
      using errcode = '22023';
  end if;

  if new.status = 'cancelled' and new.cancelled_by is null then
    raise exception
      'Inventory count session canceller is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_count_sessions_workflow_actor_evidence
  on public.inventory_count_sessions;
create trigger inventory_count_sessions_workflow_actor_evidence
before insert on public.inventory_count_sessions
for each row execute function private.enforce_inventory_count_session_workflow_actor_evidence();

revoke all on function private.enforce_inventory_count_session_workflow_actor_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_count_session_workflow_actor_evidence() is
  'Fail closed: inventory_count_sessions INSERT requires the matching workflow actor when status is submitted/approved/cancelled. Account-deletion anonymization UPDATEs remain permitted.';
