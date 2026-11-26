-- Purchase-decision ledger inserts must carry an actor_user_id.
--
-- `public.purchase_decision_events.actor_user_id` is nullable so account
-- deletion anonymization can clear only the deleted operator's auth identity
-- while preserving append-only business fields (ON DELETE SET NULL + the
-- append-only UPDATE escape in private.reject_purchase_decision_event_mutation).
-- Hosted private.record_purchase_decision_base_event and
-- private.record_purchase_decision_compensation stamp auth.uid(), but any
-- insert path that reaches the table can still mint an unattributable
-- approve, dismiss, undo, or exclusion row with actor_user_id null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (approve/dismiss/undo/exclude writers, future service inserts) when
-- actor_user_id is null. Account-deletion anonymization UPDATEs remain
-- allowed — there is intentionally no NOT NULL CHECK, because a CHECK would
-- block the ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, RLS, and append-only
-- behavior stay in place. Does not rewrite
-- record_purchase_decision_base_event, record_purchase_decision_compensation,
-- reject_purchase_decision_event_mutation, or the approve/dismiss/undo/
-- exclude wrappers. History is never rewritten. Nothing is relaxed.

create or replace function private.enforce_purchase_decision_actor_userid_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.actor_user_id is null then
    raise exception
      'Purchase decision actor is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_decision_events_actor_userid_evidence
  on public.purchase_decision_events;
create trigger purchase_decision_events_actor_userid_evidence
before insert on public.purchase_decision_events
for each row execute function private.enforce_purchase_decision_actor_userid_evidence();

revoke all on function private.enforce_purchase_decision_actor_userid_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_decision_actor_userid_evidence() is
  'Fail closed: purchase_decision_events INSERT requires a non-null actor_user_id. Account-deletion anonymization UPDATEs remain permitted.';
