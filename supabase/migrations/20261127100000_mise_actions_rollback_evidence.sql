-- Mise-action inserts that claim reversed status must carry a rollback
-- reference.
--
-- `public.mise_actions.rollback_reference` is nullable because non-reversed
-- statuses (prepared, waiting_for_approval, approved, executed, failed, …)
-- legitimately leave it null. Domain markReversed already requires a
-- non-empty rollback reference when advancing an action to reversed, but any
-- INSERT that reaches the table can still mint a reversed action with
-- rollback_reference null.
--
-- Writers normally INSERT pre-execution or executed statuses and only later
-- UPDATE into reversed with a stamped rollback reference, so those
-- pre-reversal inserts legitimately leave the field null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is reversed and
-- rollback_reference is null/blank after trim. Non-reversed inserts and
-- reversal UPDATEs remain allowed — there is intentionally no NOT NULL /
-- status-implies-reference CHECK, because a CHECK would block legitimate
-- non-reversed rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite decide_mise_action or service_record_mise_action_failure.
-- History is never rewritten. Nothing is relaxed.

create or replace function private.enforce_mise_actions_rollback_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'reversed'
    and nullif(btrim(new.rollback_reference), '') is null
  then
    raise exception
      'Mise action rollback evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists mise_actions_rollback_evidence
  on public.mise_actions;
create trigger mise_actions_rollback_evidence
before insert on public.mise_actions
for each row execute function private.enforce_mise_actions_rollback_evidence();

revoke all on function private.enforce_mise_actions_rollback_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_mise_actions_rollback_evidence() is
  'Fail closed: mise_actions INSERT requires a non-empty rollback_reference when status is reversed. Non-reversed inserts and reversal UPDATEs remain permitted.';
