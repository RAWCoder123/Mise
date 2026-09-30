# MISE-005DS — outreach_enrollments status / claimed_from_status locale pin

**Date:** 2026-09-30  
**Branch:** `cursor/mise-outreach-enrollments-status-locale-pin`  
**Base:** `origin/main` @ `78da737`  
**Milestone ID:** MISE-005DS (continues locale-pin cluster after MISE-005DR / #530)

## Goal

Pin `public.outreach_enrollments.status` and
`public.outreach_enrollments.claimed_from_status` CHECK constraints to
exact-token allowlists plus ASCII shape under `COLLATE "C"`, so dump/restore
cannot accept enrollment-lifecycle or claim-origin bytes the restored C-locale
path would refuse.

## Tokens

**status:** `queued` / `awaiting_review` / `ready` / `processing` / `contacted` /
`replied` / `interested` / `not_interested` / `completed` / `suppressed` /
`attention_required`

**claimed_from_status (nullable):** `queued` / `ready` / `contacted`

## Scope

- Additive CHECK-only migration:
  `20260930330000_mise_005ds_outreach_enrollments_status_locale_pin.sql`
- Does **not** rewrite outreach-agent edge writers, `outreach_messages.status`,
  `outreach_leads` (#530), `outreach_campaigns.status` (#529),
  `outreach_suppressions` (#527), or `outreach_agent_runs` (#528)

## Verification

- `npm run typecheck` — pass
- Focused `outreachEnrollmentsStatusLocalePin` — 3/3 pass
- `npm test` — see commit evidence
- pgTAP plan **30** derived from **30** assertion call sites in
  `supabase/tests/database/outreach_enrollments_status_locale_pin.test.sql`
  (Docker pgTAP not run in this environment)

## Why this next

Open tip #530 deferred enrollments `status` / `claimed_from_status`. Those
columns still used bare IN allowlists with no COLLATE C ASCII shape gate.
Enrollment claim/release and queue restore depend on exact ASCII tokens.
