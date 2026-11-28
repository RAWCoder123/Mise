-- Outreach agent run inserts that claim completed/failed must carry completed_at.
--
-- `public.outreach_agent_runs.completed_at` is nullable because running rows
-- legitimately leave it null until a later complete / fail UPDATE stamps the
-- timestamp. Soft table constraints do not require completed_at when status is
-- completed or failed. Hosted completion and failure transitions already stamp
-- completed_at on UPDATE, but any INSERT that reaches the table can still mint
-- a terminal run with completed_at null.
--
-- Authenticated client DML is revoked; service_role retains INSERT and can
-- still mint untimed terminal runs directly. The agent writer INSERTs status =
-- 'running' with completed_at null until a later complete / fail path stamps
-- the timestamp on UPDATE.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'completed' or 'failed' and completed_at is null. Running
-- inserts and complete / fail UPDATEs remain allowed — there is intentionally
-- no NOT NULL / status-implies-timestamp CHECK, because a CHECK would block
-- legitimate running rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite the outreach-agent writer. History is never rewritten.
-- Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1328, including the sibling
-- outreach_agent_runs failure-evidence tip (#1327) and mise_actions
-- executed_at evidence (#1304). Sibling of supplier-order sent_at (#1319) and
-- outreach-message sent_at (#1328).

create or replace function private.enforce_outreach_agent_run_completed_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('completed', 'failed')
    and new.completed_at is null
  then
    raise exception
      'Outreach agent run completion time evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_agent_runs_completed_at_evidence
  on public.outreach_agent_runs;
create trigger outreach_agent_runs_completed_at_evidence
before insert on public.outreach_agent_runs
for each row execute function private.enforce_outreach_agent_run_completed_at_evidence();

revoke all on function private.enforce_outreach_agent_run_completed_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_outreach_agent_run_completed_at_evidence() is
  'Fail closed: outreach_agent_runs INSERT requires completed_at when status is completed or failed. Running inserts and complete/fail UPDATEs remain permitted.';
