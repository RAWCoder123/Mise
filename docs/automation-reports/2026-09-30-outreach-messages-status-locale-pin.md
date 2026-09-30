# MISE-005DT: outreach_messages.status locale pin

**Date:** 2026-09-30  
**Branch:** `cursor/mise-outreach-messages-status-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open stacks through #531)

## Change

Replace the bare-IN `public.outreach_messages.status` CHECK with the same
exact-token allowlist plus ASCII shape under `COLLATE "C"`:

`draft` / `approved` / `sending` / `sent` / `delivered` / `failed` /
`send_unknown` / `bounced` / `complained` / `suppressed` / `cancelled`

## Scope

- CHECK-only additive migration `20260930340000_mise_005dt_...`
- Does **not** rewrite outreach-agent or outreach-webhook writers
- Does **not** touch `generation_provider` (#525), enrollments (#531),
  leads (#530), campaigns (#529), suppressions (#527), or agent_runs (#528)

## Why

MISE-005A proved locale drift on this cluster. A bare-IN status CHECK can
accept message-status bytes that a restored C-locale path would refuse (or
the reverse), breaking message lifecycle continuity across dump/restore.

## Verification

- `npm run typecheck` — pass
- Focused `outreachMessagesStatusLocalePin` — 3/3 pass
- `npm test` — 679 pass / 0 fail / 7 cancelledByParent noise
- pgTAP plan **19** derived from **19** assertion call sites (Docker pgTAP
  not run in this environment)

## Files

- `supabase/migrations/20260930340000_mise_005dt_outreach_messages_status_locale_pin.sql`
- `supabase/tests/database/outreach_messages_status_locale_pin.test.sql`
- `tests/outreachMessagesStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-outreach-messages-status-locale-pin.md`
