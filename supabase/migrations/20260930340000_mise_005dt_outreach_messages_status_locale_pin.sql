-- MISE-005DT: pin public.outreach_messages.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- public.outreach_messages stores message lifecycle under a bare IN
-- allowlist from outreach_agent:
--   status in ('draft', 'approved', 'sending', 'sent', 'delivered', 'failed',
--              'send_unknown', 'bounced', 'complained', 'suppressed',
--              'cancelled')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'draft' | 'approved' | 'sending' | 'sent' | 'delivered' | 'failed'
--   | 'send_unknown' | 'bounced' | 'complained' | 'suppressed' | 'cancelled'
--
-- status gates draft review, send attempt progression, provider delivery
-- outcomes, bounce/complaint handling, suppression, and cancellation.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; open sibling
-- pins through #531 leave outreach_messages.status on bare IN. Open tip
-- #525 pinned generation_provider on the same table and deferred status;
-- #531 deferred messages.status after enrollments.
--
-- If LC_CTYPE drifted under a bare-IN outreach_messages.status CHECK,
-- dump/restore could accept message-status bytes the restored C-locale
-- path (and sibling outreach gates) would refuse — or the reverse —
-- breaking message lifecycle continuity across restore.
--
-- Scope:
--   - Replace outreach_messages_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite outreach-agent or outreach-webhook edge writers,
-- generation_provider (#525), subject/body bounds, model_name,
-- idempotency_key (#471), provider_message_id (#470),
-- outreach_enrollments (#531), outreach_leads (#530),
-- outreach_campaigns.status (#529), outreach_suppressions (#527), or
-- outreach_agent_runs (#528). Timestamp after MISE-005DS (#531).

alter table public.outreach_messages
  drop constraint if exists outreach_messages_status_check;

alter table public.outreach_messages
  add constraint outreach_messages_status_check
  check (
    status in (
      'draft',
      'approved',
      'sending',
      'sent',
      'delivered',
      'failed',
      'send_unknown',
      'bounced',
      'complained',
      'suppressed',
      'cancelled'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_messages_status_check
  on public.outreach_messages is
  'MISE-005DT: exact draft/approved/sending/sent/delivered/failed/send_unknown/bounced/complained/suppressed/cancelled allowlist plus ASCII shape under COLLATE "C". Outreach message lifecycle state.';

comment on column public.outreach_messages.status is
  'Outreach message lifecycle. Allowed values: draft, approved, sending, sent, delivered, failed, send_unknown, bounced, complained, suppressed, cancelled under COLLATE "C".';
