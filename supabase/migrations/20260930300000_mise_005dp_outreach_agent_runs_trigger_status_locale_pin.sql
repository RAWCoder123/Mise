-- MISE-005DP: pin public.outreach_agent_runs.trigger_type and
-- public.outreach_agent_runs.status CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- public.outreach_agent_runs stores outreach-agent run vocabulary under
-- bare IN allowlists from outreach_agent:
--   trigger_type in ('manual', 'scheduled')
--   status in ('running', 'completed', 'failed')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   trigger_type:
--     'manual'     — operator-invoked outreach-agent run
--     'scheduled'  — cron/scheduled outreach-agent run
--   status:
--     'running'    — run accepted and in flight
--     'completed'  — finished with truthful counts
--     'failed'     — failed closed with error_summary
--
-- trigger_type and status gate service-only outreach-agent run ledger
-- continuity, operator monitoring of campaign wake cycles, and truthful
-- completion/failure accounting. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; open sibling pins through #527 leave
-- outreach_agent_runs vocabulary on bare IN. Open tip #527 explicitly
-- deferred these columns.
--
-- If LC_CTYPE drifted under bare-IN outreach_agent_runs vocabulary
-- CHECKs, dump/restore could accept run-vocabulary bytes the restored
-- C-locale path (and sibling outreach gates) would refuse — or the
-- reverse — breaking agent-run ledger continuity across restore.
--
-- Scope:
--   - Replace outreach_agent_runs_trigger_type_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - Replace outreach_agent_runs_status_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite outreach-agent edge writers, campaign/enrollment/
-- message status vocabularies, generation_provider (#525), or
-- outreach_suppressions reason/source (#527).
-- Timestamp after MISE-005DO (#527).

alter table public.outreach_agent_runs
  drop constraint if exists outreach_agent_runs_trigger_type_check;

alter table public.outreach_agent_runs
  add constraint outreach_agent_runs_trigger_type_check
  check (
    trigger_type in ('manual', 'scheduled')
    and trigger_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

alter table public.outreach_agent_runs
  drop constraint if exists outreach_agent_runs_status_check;

alter table public.outreach_agent_runs
  add constraint outreach_agent_runs_status_check
  check (
    status in ('running', 'completed', 'failed')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_agent_runs_trigger_type_check
  on public.outreach_agent_runs is
  'MISE-005DP: exact manual/scheduled allowlist plus ASCII shape under COLLATE "C". Outreach agent run trigger vocabulary.';

comment on constraint outreach_agent_runs_status_check
  on public.outreach_agent_runs is
  'MISE-005DP: exact running/completed/failed allowlist plus ASCII shape under COLLATE "C". Outreach agent run lifecycle state.';

comment on column public.outreach_agent_runs.trigger_type is
  'Outreach agent run trigger. Allowed values: manual, scheduled under COLLATE "C".';

comment on column public.outreach_agent_runs.status is
  'Outreach agent run lifecycle. Allowed values: running, completed, failed under COLLATE "C".';
