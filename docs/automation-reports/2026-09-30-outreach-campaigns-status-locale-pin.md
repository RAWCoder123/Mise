# MISE-005DQ: outreach_campaigns.status locale pin

Date: 2026-09-30  
Branch: `cursor/mise-outreach-campaigns-status-locale-pin`  
Base: `origin/main` @ `78da737` (open tip #528 deferred this column)

## Change

Replace the bare-IN CHECK allowlist on `public.outreach_campaigns.status`
with the same exact tokens plus ASCII shape under `COLLATE "C"`:

| Column | Tokens |
| --- | --- |
| `status` | `draft` / `active` / `paused` / `completed` |

Migration: `20260930310000_mise_005dq_outreach_campaigns_status_locale_pin.sql`

## Scope

- CHECK-only additive migration
- Does **not** rewrite outreach-agent edge writers, leads/enrollments/messages
  status, `contact_basis`, `claimed_from_status`, `generation_provider` (#525),
  `outreach_suppressions` (#527), or `outreach_agent_runs` trigger_type/status
  (#528)

## Why

MISE-005A proved locale drift on this cluster. Bare-IN allowlists without a
`COLLATE "C"` ASCII shape gate can accept dump/restore vocabulary bytes that
the restored C-locale path would refuse, breaking campaign lifecycle continuity.

## Verification

- `npm run typecheck`
- Focused `outreachCampaignsStatusLocalePin`
- `npm test`
- pgTAP plan **15** counted from 15 assertion call sites in
  `outreach_campaigns_status_locale_pin.test.sql` (Docker pgTAP not
  run in this environment)

## Next alone-OK candidates

- leads `status` / `contact_basis`
- enrollments `status` / `claimed_from_status`
- messages `status`
- Gmail delivery status
