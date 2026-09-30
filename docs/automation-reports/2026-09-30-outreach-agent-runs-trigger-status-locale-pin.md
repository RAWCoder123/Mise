# MISE-005DP: outreach_agent_runs trigger_type/status locale pin

Date: 2026-09-30  
Branch: `cursor/mise-outreach-agent-runs-trigger-status-locale-pin`  
Base: `origin/main` @ `78da737` (open tip #527 deferred these columns)

## Change

Replace bare-IN CHECK allowlists on `public.outreach_agent_runs.trigger_type`
and `public.outreach_agent_runs.status` with the same exact tokens plus ASCII
shape under `COLLATE "C"`:

| Column | Tokens |
| --- | --- |
| `trigger_type` | `manual` / `scheduled` |
| `status` | `running` / `completed` / `failed` |

Migration: `20260930300000_mise_005dp_outreach_agent_runs_trigger_status_locale_pin.sql`

## Scope

- CHECK-only additive migration
- Does **not** rewrite outreach-agent edge writers, campaign/enrollment/message
  status, `generation_provider` (#525), or `outreach_suppressions` reason/source
  (#527)

## Why

MISE-005A proved locale drift on this cluster. Bare-IN allowlists without a
`COLLATE "C"` ASCII shape gate can accept dump/restore vocabulary bytes that
the restored C-locale path would refuse, breaking agent-run ledger continuity.

## Verification

- `npm run typecheck`
- Focused `outreachAgentRunsTriggerStatusLocalePin`
- `npm test`
- pgTAP plan **16** counted from 16 assertion call sites in
  `outreach_agent_runs_trigger_status_locale_pin.test.sql` (Docker pgTAP not
  run in this environment)

## Next alone-OK candidates

- `outreach_campaigns.status`
- leads `status` / `contact_basis`
- enrollments `status` / `claimed_from_status`
- messages `status`
- Gmail delivery status
