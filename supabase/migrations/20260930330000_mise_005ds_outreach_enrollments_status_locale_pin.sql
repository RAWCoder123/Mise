-- MISE-005DS: pin public.outreach_enrollments.status and
-- public.outreach_enrollments.claimed_from_status CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- public.outreach_enrollments stores enrollment lifecycle and claim-origin
-- under bare IN allowlists from outreach_agent:
--   status in ('queued', 'awaiting_review', 'ready', 'processing', 'contacted',
--              'replied', 'interested', 'not_interested', 'completed',
--              'suppressed', 'attention_required')
--   claimed_from_status in ('queued', 'ready', 'contacted')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   status: 'queued' | 'awaiting_review' | 'ready' | 'processing' | 'contacted'
--           | 'replied' | 'interested' | 'not_interested' | 'completed'
--           | 'suppressed' | 'attention_required'
--   claimed_from_status: 'queued' | 'ready' | 'contacted' (nullable)
--
-- status gates enrollment queue claim/release, review readiness, send
-- outcomes, suppression, and attention escalation. claimed_from_status
-- records the pre-claim status so stale claims can restore queue continuity.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; open sibling
-- pins through #530 leave outreach_enrollments vocabulary on bare IN.
-- Open tip #530 explicitly deferred these columns.
--
-- If LC_CTYPE drifted under a bare-IN outreach_enrollments vocabulary CHECK,
-- dump/restore could accept enrollment-status or claim-origin bytes the
-- restored C-locale path (and sibling outreach gates) would refuse — or the
-- reverse — breaking enrollment lifecycle and claim-restore continuity
-- across restore.
--
-- Scope:
--   - Replace outreach_enrollments_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace outreach_enrollments_claimed_from_status_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite outreach-agent edge writers, outreach_messages.status,
-- outreach_leads (#530), outreach_campaigns.status (#529),
-- outreach_suppressions (#527), or outreach_agent_runs (#528).
-- Timestamp after MISE-005DR (#530).

alter table public.outreach_enrollments
  drop constraint if exists outreach_enrollments_status_check;

alter table public.outreach_enrollments
  add constraint outreach_enrollments_status_check
  check (
    status in (
      'queued',
      'awaiting_review',
      'ready',
      'processing',
      'contacted',
      'replied',
      'interested',
      'not_interested',
      'completed',
      'suppressed',
      'attention_required'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_enrollments_status_check
  on public.outreach_enrollments is
  'MISE-005DS: exact queued/awaiting_review/ready/processing/contacted/replied/interested/not_interested/completed/suppressed/attention_required allowlist plus ASCII shape under COLLATE "C". Outreach enrollment lifecycle state.';

comment on column public.outreach_enrollments.status is
  'Outreach enrollment lifecycle. Allowed values: queued, awaiting_review, ready, processing, contacted, replied, interested, not_interested, completed, suppressed, attention_required under COLLATE "C".';

alter table public.outreach_enrollments
  drop constraint if exists outreach_enrollments_claimed_from_status_check;

alter table public.outreach_enrollments
  add constraint outreach_enrollments_claimed_from_status_check
  check (
    claimed_from_status in ('queued', 'ready', 'contacted')
    and claimed_from_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_enrollments_claimed_from_status_check
  on public.outreach_enrollments is
  'MISE-005DS: exact queued/ready/contacted allowlist plus ASCII shape under COLLATE "C". Nullable claim-origin status for queue restore.';

comment on column public.outreach_enrollments.claimed_from_status is
  'Pre-claim enrollment status for stale-claim restore. Allowed values when set: queued, ready, contacted under COLLATE "C".';
