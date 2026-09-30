-- MISE-005DQ: pin public.outreach_campaigns.status CHECK to
-- COLLATE "C", preserving the exact-token allowlist.
--
-- public.outreach_campaigns stores campaign lifecycle under a bare IN
-- allowlist from outreach_agent:
--   status in ('draft', 'active', 'paused', 'completed')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'draft'      — campaign configured, not yet activated
--   'active'     — approved and eligible for agent wake cycles
--   'paused'     — temporarily halted without completion
--   'completed'  — finished; no further enrollments or sends
--
-- status gates service-only outreach campaign activation continuity,
-- agent wake eligibility (active only), and truthful pause/completion
-- accounting. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins through #528 leave outreach_campaigns
-- status on bare IN. Open tip #528 explicitly deferred this column.
--
-- If LC_CTYPE drifted under the bare-IN outreach_campaigns.status
-- CHECK, dump/restore could accept campaign-status bytes the restored
-- C-locale path (and sibling outreach gates) would refuse — or the
-- reverse — breaking campaign lifecycle continuity across restore.
--
-- Scope:
--   - Replace outreach_campaigns_status_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite outreach-agent edge writers, leads/enrollments/
-- messages status, contact_basis, claimed_from_status,
-- generation_provider (#525), outreach_suppressions (#527), or
-- outreach_agent_runs trigger_type/status (#528).
-- Timestamp after MISE-005DP (#528).

alter table public.outreach_campaigns
  drop constraint if exists outreach_campaigns_status_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_status_check
  check (
    status in ('draft', 'active', 'paused', 'completed')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_campaigns_status_check
  on public.outreach_campaigns is
  'MISE-005DQ: exact draft/active/paused/completed allowlist plus ASCII shape under COLLATE "C". Outreach campaign lifecycle state.';

comment on column public.outreach_campaigns.status is
  'Outreach campaign lifecycle. Allowed values: draft, active, paused, completed under COLLATE "C".';
