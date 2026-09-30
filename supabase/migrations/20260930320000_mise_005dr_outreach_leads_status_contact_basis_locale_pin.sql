-- MISE-005DR: pin public.outreach_leads.status and
-- public.outreach_leads.contact_basis CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- public.outreach_leads stores lead lifecycle and contact provenance under
-- bare IN allowlists from outreach_agent:
--   status in ('new', 'approved', 'contacted', 'replied', 'interested',
--              'not_interested', 'unsubscribed', 'bounced', 'invalid')
--   contact_basis in ('public_business_contact', 'referral', 'opt_in')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   status: 'new' | 'approved' | 'contacted' | 'replied' | 'interested'
--           | 'not_interested' | 'unsubscribed' | 'bounced' | 'invalid'
--   contact_basis: 'public_business_contact' | 'referral' | 'opt_in'
--
-- status gates lead approval continuity, suppression-driven transitions
-- (hard_bounce -> bounced; recipient_request/spam_complaint ->
-- unsubscribed), and enrollment eligibility. contact_basis gates lawful
-- contact provenance for approved outreach. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; open sibling pins through #529 leave
-- outreach_leads vocabulary on bare IN. Open tip #529 explicitly deferred
-- these columns.
--
-- If LC_CTYPE drifted under a bare-IN outreach_leads vocabulary CHECK,
-- dump/restore could accept lead-status or contact-basis bytes the restored
-- C-locale path (and sibling outreach gates) would refuse — or the
-- reverse — breaking lead lifecycle and contact-basis continuity across
-- restore.
--
-- Scope:
--   - Replace outreach_leads_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace outreach_leads_contact_basis_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite outreach-agent edge writers, enrollments status /
-- claimed_from_status, messages status, outreach_campaigns.status (#529),
-- outreach_suppressions (#527), or outreach_agent_runs (#528).
-- Timestamp after MISE-005DQ (#529).

alter table public.outreach_leads
  drop constraint if exists outreach_leads_status_check;

alter table public.outreach_leads
  add constraint outreach_leads_status_check
  check (
    status in (
      'new',
      'approved',
      'contacted',
      'replied',
      'interested',
      'not_interested',
      'unsubscribed',
      'bounced',
      'invalid'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_leads_status_check
  on public.outreach_leads is
  'MISE-005DR: exact new/approved/contacted/replied/interested/not_interested/unsubscribed/bounced/invalid allowlist plus ASCII shape under COLLATE "C". Outreach lead lifecycle state.';

comment on column public.outreach_leads.status is
  'Outreach lead lifecycle. Allowed values: new, approved, contacted, replied, interested, not_interested, unsubscribed, bounced, invalid under COLLATE "C".';

alter table public.outreach_leads
  drop constraint if exists outreach_leads_contact_basis_check;

alter table public.outreach_leads
  add constraint outreach_leads_contact_basis_check
  check (
    contact_basis in ('public_business_contact', 'referral', 'opt_in')
    and contact_basis collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint outreach_leads_contact_basis_check
  on public.outreach_leads is
  'MISE-005DR: exact public_business_contact/referral/opt_in allowlist plus ASCII shape under COLLATE "C". Outreach lead contact provenance.';

comment on column public.outreach_leads.contact_basis is
  'Outreach lead contact basis. Allowed values: public_business_contact, referral, opt_in under COLLATE "C".';
