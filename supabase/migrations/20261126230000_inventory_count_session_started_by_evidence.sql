-- Inventory count-session inserts must carry a started_by actor.
--
-- `public.inventory_count_sessions.started_by` is nullable so account
-- deletion anonymization can clear only the deleted operator's auth identity
-- while preserving the session's operational history (ON DELETE SET NULL).
-- Hosted private.service_begin_inventory_count_session stamps
-- p_actor_user_id into started_by, but any insert path that reaches the
-- table can still mint an unattributable count session with started_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when started_by is null.
-- Account-deletion anonymization UPDATEs remain allowed — there is
-- intentionally no NOT NULL CHECK, because a CHECK would block the
-- ON DELETE SET NULL escape.
--
-- submitted_by / approved_by / cancelled_by stay nullable at INSERT time
-- (they are stamped by later workflow steps). Soft CHECKs, FKs,
-- grants/revokes, tenant isolation, and RLS stay in place. Does not rewrite
-- service_begin / submit / approve / cancel writers. History is never
-- rewritten. Nothing is relaxed.

create or replace function private.enforce_inventory_count_session_started_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.started_by is null then
    raise exception
      'Inventory count session starter is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_count_sessions_started_by_evidence
  on public.inventory_count_sessions;
create trigger inventory_count_sessions_started_by_evidence
before insert on public.inventory_count_sessions
for each row execute function private.enforce_inventory_count_session_started_by_evidence();

revoke all on function private.enforce_inventory_count_session_started_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_count_session_started_by_evidence() is
  'Fail closed: inventory_count_sessions INSERT requires a non-null started_by. Account-deletion anonymization UPDATEs remain permitted.';
