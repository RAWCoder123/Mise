-- MISE-005DO: pin public.outreach_suppressions.reason and
-- public.outreach_suppressions.source CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- Outreach suppression vocabulary columns store suppression reason and
-- provenance under bare IN allowlists from outreach_agent:
--   reason in ('recipient_request', 'hard_bounce', 'spam_complaint',
--              'provider_suppression', 'manual')
--   source in ('unsubscribe', 'resend_webhook', 'operator')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   reason: 'recipient_request' | 'hard_bounce' | 'spam_complaint'
--           | 'provider_suppression' | 'manual'
--   source: 'unsubscribe' | 'resend_webhook' | 'operator'
--
-- reason gates lead status transitions (hard_bounce -> bounced;
-- recipient_request/spam_complaint -> unsubscribed), unsubscribe RPC
-- allowlists, and webhook suppression writes. source gates provenance
-- for unsubscribe links, Resend webhooks, and operator actions.
-- POSIX character classes follow database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; open
-- sibling pins through #526 leave outreach_suppressions vocabulary on
-- bare IN. Open tip #526/#525 explicitly deferred these columns.
--
-- If LC_CTYPE drifted under a bare-IN outreach_suppressions vocabulary
-- CHECK, dump/restore could accept reason or source bytes the restored
-- C-locale path (and sibling outreach gates) would refuse — or the
-- reverse — breaking suppression provenance continuity across restore.
--
-- Scope:
--   - Replace outreach_suppressions_reason_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - Replace outreach_suppressions_source_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_unsubscribe_outreach, outreach-webhook /
-- outreach-agent edge writers, message status, generation_provider,
-- purchase_lines.source, or other bare-IN vocabularies.
-- Timestamp after MISE-005DN (#526).

alter table public.outreach_suppressions
  drop constraint if exists outreach_suppressions_reason_check;

alter table public.outreach_suppressions
  add constraint outreach_suppressions_reason_check
  check (
    reason in (
      'recipient_request',
      'hard_bounce',
      'spam_complaint',
      'provider_suppression',
      'manual'
    )
    and reason collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_suppressions_reason_check
  on public.outreach_suppressions is
  'MISE-005DO: exact recipient_request/hard_bounce/spam_complaint/provider_suppression/manual allowlist plus ASCII shape under COLLATE "C". Outreach suppression reason vocabulary.';

comment on column public.outreach_suppressions.reason is
  'Outreach suppression reason. Allowed values: recipient_request, hard_bounce, spam_complaint, provider_suppression, manual under COLLATE "C".';

alter table public.outreach_suppressions
  drop constraint if exists outreach_suppressions_source_check;

alter table public.outreach_suppressions
  add constraint outreach_suppressions_source_check
  check (
    source in ('unsubscribe', 'resend_webhook', 'operator')
    and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_suppressions_source_check
  on public.outreach_suppressions is
  'MISE-005DO: exact unsubscribe/resend_webhook/operator allowlist plus ASCII shape under COLLATE "C". Outreach suppression source vocabulary.';

comment on column public.outreach_suppressions.source is
  'Outreach suppression source. Allowed values: unsubscribe, resend_webhook, operator under COLLATE "C".';
