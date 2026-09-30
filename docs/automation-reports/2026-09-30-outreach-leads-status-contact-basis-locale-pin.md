# MISE-005DR: outreach_leads status/contact_basis locale pin

Date: 2026-09-30  
Branch: `cursor/mise-outreach-leads-status-contact-basis-locale-pin`  
Base: `origin/main` @ `78da737` (open tip #529 deferred these columns)

## Change

Replace the bare-IN CHECK allowlists on `public.outreach_leads.status` and
`public.outreach_leads.contact_basis` with the same exact tokens plus ASCII
shape under `COLLATE "C"`:

| Column | Tokens |
| --- | --- |
| `status` | `new` / `approved` / `contacted` / `replied` / `interested` / `not_interested` / `unsubscribed` / `bounced` / `invalid` |
| `contact_basis` | `public_business_contact` / `referral` / `opt_in` |

Migration: `20260930320000_mise_005dr_outreach_leads_status_contact_basis_locale_pin.sql`

## Scope

- CHECK-only additive migration
- Does **not** rewrite outreach-agent edge writers, enrollments status /
  `claimed_from_status`, messages status, `outreach_campaigns.status` (#529),
  `outreach_suppressions` (#527), or `outreach_agent_runs` (#528)

## Why

MISE-005A proved locale drift on this cluster. Bare-IN allowlists without a
`COLLATE "C"` ASCII shape gate can accept dump/restore vocabulary bytes that
the restored C-locale path would refuse, breaking lead lifecycle and
contact-basis continuity.

## Verification

- `npm run typecheck`
- Focused `outreachLeadsStatusContactBasisLocalePin`
- `npm test`
- pgTAP plan **28** counted from 28 assertion call sites in
  `outreach_leads_status_contact_basis_locale_pin.test.sql` (Docker pgTAP not
  run in this environment)

## Next alone-OK candidates

- enrollments `status` / `claimed_from_status`
- messages `status`
- Gmail delivery status
