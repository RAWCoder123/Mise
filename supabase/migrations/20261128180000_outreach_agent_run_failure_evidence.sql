-- Outreach agent run inserts that claim failed must carry error_summary.
--
-- `public.outreach_agent_runs.error_summary` is nullable because running and
-- completed rows legitimately leave it null (completed runs only stamp a
-- summary when the agent collected non-fatal errors). Hosted failure
-- transitions already stamp a bounded reason into error_summary on UPDATE, but
-- any INSERT that reaches the table can still mint a failed run with
-- error_summary null or blank after trim.
--
-- Authenticated client DML is revoked; service_role retains INSERT and can
-- still mint unexplained failures directly. The agent writer INSERTs status =
-- 'running' with error_summary null until a later fail path stamps evidence on
-- UPDATE.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'failed' and error_summary is null/blank after trim.
-- Running / completed inserts and failure UPDATEs remain allowed — there is
-- intentionally no NOT NULL / status-implies-error CHECK, because a CHECK
-- would block legitimate running / completed rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite the outreach-agent writer. History is never rewritten.
-- Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1326, the error_summary cntrl locale pin, and
-- mise_actions failure evidence (#1305). Sibling of outreach message failure
-- evidence (#1326).

create or replace function private.enforce_outreach_agent_run_failure_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'failed'
    and nullif(btrim(new.error_summary), '') is null
  then
    raise exception
      'Outreach agent run failure evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_agent_runs_failure_evidence
  on public.outreach_agent_runs;
create trigger outreach_agent_runs_failure_evidence
before insert on public.outreach_agent_runs
for each row execute function private.enforce_outreach_agent_run_failure_evidence();

revoke all on function private.enforce_outreach_agent_run_failure_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_outreach_agent_run_failure_evidence() is
  'Fail closed: outreach_agent_runs INSERT requires a non-empty error_summary when status is failed. Running/completed inserts and failure UPDATEs remain permitted.';
