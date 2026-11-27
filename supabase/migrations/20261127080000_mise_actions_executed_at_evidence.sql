-- Mise-action inserts that claim executed status must carry executed_at.
--
-- `public.mise_actions.executed_at` is nullable because non-executed statuses
-- (prepared, waiting_for_approval, failed, unverified, …) and failure UPDATEs
-- legitimately leave it null. Hosted writers that advance an action to
-- executed stamp executed_at (foundation supplier-order acceptance coalesces
-- sent_at / now(), and the historical backfill stamps
-- coalesce(orders.sent_at, orders.created_at) when inserting already-sent
-- orders as executed), but any INSERT that reaches the table can still mint
-- an executed action with executed_at null.
--
-- Writers normally INSERT pre-execution statuses and only later UPDATE into
-- executed with a stamped timestamp, so those pre-execution inserts
-- legitimately leave executed_at null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is executed and
-- executed_at is null. Failure UPDATEs and non-executed inserts remain
-- allowed — there is intentionally no NOT NULL / status-implies-timestamp
-- CHECK, because a CHECK would block legitimate non-executed rows and
-- failure paths that leave executed_at null.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite decide_mise_action or supplier-send writers. History is
-- never rewritten. Nothing is relaxed.

create or replace function private.enforce_mise_actions_executed_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'executed' and new.executed_at is null then
    raise exception
      'Mise action execution time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists mise_actions_executed_at_evidence
  on public.mise_actions;
create trigger mise_actions_executed_at_evidence
before insert on public.mise_actions
for each row execute function private.enforce_mise_actions_executed_at_evidence();

revoke all on function private.enforce_mise_actions_executed_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_mise_actions_executed_at_evidence() is
  'Fail closed: mise_actions INSERT requires a non-null executed_at when status is executed. Non-executed inserts and failure UPDATEs remain permitted.';
