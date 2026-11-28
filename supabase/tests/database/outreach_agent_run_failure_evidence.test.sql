create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' outreach_agent_run_failure_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(8);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

select has_function(
  'private',
  'enforce_outreach_agent_run_failure_evidence',
  'outreach agent run failure evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      trigger_type, status
    ) values (
      'manual', 'failed'
    )
  $sql$),
  'Outreach agent run failure evidence is required',
  'direct outreach_agent_runs insert cannot mint failed status without error_summary'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      trigger_type, status, error_summary
    ) values (
      'scheduled', 'failed', '   '
    )
  $sql$),
  'Outreach agent run failure evidence is required',
  'direct outreach_agent_runs insert cannot mint failed status with blank error_summary'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      id, trigger_type, status, error_summary, completed_at
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'manual', 'failed',
      'campaign_claim_rpc_unavailable',
      now()
    )
  $sql$),
  null,
  'direct outreach_agent_runs insert with error_summary remains allowed for failed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      id, trigger_type, status
    ) values (
      'c0000000-0000-4000-8000-000000000002',
      'manual', 'running'
    )
  $sql$),
  null,
  'direct outreach_agent_runs insert can open running without failure evidence'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      id, trigger_type, status, campaigns_checked, completed_at
    ) values (
      'c0000000-0000-4000-8000-000000000003',
      'scheduled', 'completed', 2, now()
    )
  $sql$),
  null,
  'direct outreach_agent_runs insert can mint completed status without failure evidence'
);

insert into public.outreach_agent_runs (
  id, trigger_type, status
) values (
  'c0000000-0000-4000-8000-000000000004',
  'manual', 'running'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_agent_runs
    set status = 'failed',
      error_summary = 'campaign_claim_rpc_unavailable',
      completed_at = now()
    where id = 'c0000000-0000-4000-8000-000000000004'
      and status = 'running'
  $sql$),
  null,
  'failure UPDATE with evidence remains allowed (INSERT-only tip)'
);

-- Second UPDATE escape: reuse the running insert that was allowed above
-- (id ...0002) and fail it without error_summary.
select is(
  pg_temp.error_of($sql$
    update public.outreach_agent_runs
    set status = 'failed',
      completed_at = now()
    where id = 'c0000000-0000-4000-8000-000000000002'
      and status = 'running'
  $sql$),
  null,
  'failure UPDATE without error_summary remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
