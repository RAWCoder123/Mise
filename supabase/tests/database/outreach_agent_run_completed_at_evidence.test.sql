create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' outreach_agent_run_completed_at_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(9);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

select has_function(
  'private',
  'enforce_outreach_agent_run_completed_at_evidence',
  'outreach agent run completed_at evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      trigger_type, status
    ) values (
      'manual', 'completed'
    )
  $sql$),
  'Outreach agent run completion time evidence is required',
  'direct outreach_agent_runs insert cannot mint completed status without completed_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      trigger_type, status, error_summary
    ) values (
      'scheduled', 'failed', 'campaign_claim_rpc_unavailable'
    )
  $sql$),
  'Outreach agent run completion time evidence is required',
  'direct outreach_agent_runs insert cannot mint failed status without completed_at'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      id, trigger_type, status, campaigns_checked, completed_at
    ) values (
      'c0000000-0000-4000-8000-000000000011',
      'scheduled', 'completed', 2, now()
    )
  $sql$),
  null,
  'direct outreach_agent_runs insert with completed_at remains allowed for completed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      id, trigger_type, status, error_summary, completed_at
    ) values (
      'c0000000-0000-4000-8000-000000000012',
      'manual', 'failed',
      'campaign_claim_rpc_unavailable',
      now()
    )
  $sql$),
  null,
  'direct outreach_agent_runs insert with completed_at remains allowed for failed status'
);

select is(
  pg_temp.error_of($sql$
    insert into public.outreach_agent_runs (
      id, trigger_type, status
    ) values (
      'c0000000-0000-4000-8000-000000000013',
      'manual', 'running'
    )
  $sql$),
  null,
  'direct outreach_agent_runs insert can open running without completed_at'
);

insert into public.outreach_agent_runs (
  id, trigger_type, status
) values (
  'c0000000-0000-4000-8000-000000000014',
  'manual', 'running'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_agent_runs
    set status = 'completed',
      campaigns_checked = 1,
      completed_at = now()
    where id = 'c0000000-0000-4000-8000-000000000014'
      and status = 'running'
  $sql$),
  null,
  'completion UPDATE with completed_at remains allowed (INSERT-only tip)'
);

-- Second UPDATE escape: reuse the running insert that was allowed above
-- (id ...0013) and complete it without completed_at.
select is(
  pg_temp.error_of($sql$
    update public.outreach_agent_runs
    set status = 'completed',
      campaigns_checked = 1
    where id = 'c0000000-0000-4000-8000-000000000013'
      and status = 'running'
  $sql$),
  null,
  'completion UPDATE without completed_at remains allowed (INSERT-only tip)'
);

insert into public.outreach_agent_runs (
  id, trigger_type, status
) values (
  'c0000000-0000-4000-8000-000000000015',
  'scheduled', 'running'
);

select is(
  pg_temp.error_of($sql$
    update public.outreach_agent_runs
    set status = 'failed',
      error_summary = 'campaign_claim_rpc_unavailable',
      completed_at = now()
    where id = 'c0000000-0000-4000-8000-000000000015'
      and status = 'running'
  $sql$),
  null,
  'failure UPDATE with completed_at remains allowed (INSERT-only tip)'
);

select * from finish();
rollback;
