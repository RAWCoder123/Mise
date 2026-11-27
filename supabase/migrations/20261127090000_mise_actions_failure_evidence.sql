-- Mise-action inserts that claim failed/unverified status must carry failure
-- evidence (error_code + error_message).
--
-- `public.mise_actions.error_code` and `error_message` are nullable because
-- non-failure statuses (prepared, waiting_for_approval, approved, executed, …)
-- legitimately leave them null. Hosted private.service_record_mise_action_failure
-- already rejects failure recording without a slug error_code and a non-empty
-- error_message when advancing an action to failed or unverified via UPDATE,
-- but any INSERT that reaches the table can still mint a failed/unverified
-- action with both fields null.
--
-- Writers normally INSERT pre-execution statuses and only later UPDATE into a
-- failure status with stamped evidence, so those pre-failure inserts
-- legitimately leave the error fields null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is failed or unverified
-- and either error_code or error_message is null/blank after trim. Non-failure
-- inserts and failure UPDATEs remain allowed — there is intentionally no
-- NOT NULL / status-implies-error CHECK, because a CHECK would block
-- legitimate non-failure rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite decide_mise_action or service_record_mise_action_failure.
-- History is never rewritten. Nothing is relaxed.

create or replace function private.enforce_mise_actions_failure_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('failed', 'unverified')
    and (
      nullif(btrim(new.error_code), '') is null
      or nullif(btrim(new.error_message), '') is null
    )
  then
    raise exception
      'Mise action failure evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists mise_actions_failure_evidence
  on public.mise_actions;
create trigger mise_actions_failure_evidence
before insert on public.mise_actions
for each row execute function private.enforce_mise_actions_failure_evidence();

revoke all on function private.enforce_mise_actions_failure_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_mise_actions_failure_evidence() is
  'Fail closed: mise_actions INSERT requires non-empty error_code and error_message when status is failed or unverified. Non-failure inserts and failure UPDATEs remain permitted.';
