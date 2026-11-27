-- Mise-action inserts that claim an approved/rejected decision must carry
-- approved_by.
--
-- `public.mise_actions.approved_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the action's operational history (ON DELETE SET NULL). Hosted
-- public.decide_mise_action stamps auth.uid() into approved_by via UPDATE for
-- both approve and reject decisions, but any INSERT that reaches the table can
-- still mint an approved/rejected action with approved_by null.
--
-- Writers normally INSERT prepared / waiting_for_approval and only later UPDATE
-- into a decision status, so those pre-decision inserts legitimately leave
-- approved_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is approved or rejected and
-- approved_by is null. Account-deletion anonymization UPDATEs remain allowed —
-- there is intentionally no NOT NULL / status-implies-actor CHECK, because a
-- CHECK would block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite decide_mise_action. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_mise_actions_decision_actor_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('approved', 'rejected') and new.approved_by is null then
    raise exception
      'Mise action decision actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists mise_actions_decision_actor_evidence
  on public.mise_actions;
create trigger mise_actions_decision_actor_evidence
before insert on public.mise_actions
for each row execute function private.enforce_mise_actions_decision_actor_evidence();

revoke all on function private.enforce_mise_actions_decision_actor_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_mise_actions_decision_actor_evidence() is
  'Fail closed: mise_actions INSERT requires a non-null approved_by when status is approved or rejected. Account-deletion anonymization UPDATEs remain permitted.';
