# MISE-005M: pin outreach_campaigns sender/reply email CHECKs to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-outreach-campaign-email-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.outreach_campaigns.sender_email` and `reply_to` still validate with bare
`~* '^[^[:space:]@]+@...'`. POSIX `[[:space:]]` follows database `LC_CTYPE`.
MISE-005A proved locale drift on this cluster; MISE-005L re-pinned
`outreach_leads` email shape with `collate "C"`, but left campaign From /
Reply-To on the original expression.

These addresses are the durable commercial From and Reply-To on every approved
outreach campaign. If a glibc/ICU change reclassified a stored byte under bare
`[[:space:]]`, `pg_dump`/`restore` could reject campaign rows the source
accepted.

## Change

- Additive migration `20260926072000_mise_005m_outreach_campaign_email_locale_pin.sql`
  - Reattach `outreach_campaigns_sender_email_check` and
    `outreach_campaigns_reply_to_check` with
    `<column> collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'`
- Domain `matchesOutreachEmailShape` / `OUTREACH_EMAIL_SHAPE` documents ASCII C
  space-set parity (not JS `\s`)
- Outreach agent `requireEmail` uses the shared shape helper
- Source-pin + pgTAP fixtures committed

Does **not** touch `outreach_leads` / `outreach_suppressions` (MISE-005L) and
does **not** rewrite Edge auth/service gates beyond the shared shape helper.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#420
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration
- Contested receive / `record_supplier_delivery` size checks
