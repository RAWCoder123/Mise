# MISE-005BC: outreach_campaigns.timezone COLLATE C pin

**Date:** 2026-09-28  
**Tip:** `cursor/mise-outreach-campaign-timezone-locale-pin`  
**Base:** `origin/main` @ `78da737` (+ open #348–#462)

## Problem

`public.outreach_campaigns.timezone` only enforced `char_length` 1–100. The Edge
`create_campaign` path already required a real Intl IANA name, but the table
CHECK admitted any Unicode string of that length — including ASCII controls and
spaced labels. Under `LC_CTYPE` drift, dump/restore and Edge create continuity
can disagree on the same timezone bytes. Campaign timezone drives send-window
day math (`isWithinOutreachSendWindow` / `date_trunc` in the claim path).

## Change

- Additive migration reattaches `outreach_campaigns_timezone_check` with
  `timezone collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'` (same IANA Area/Location
  ASCII class as restaurants.timezone MISE-005BB; length tightened 100 → 64).
- Edge `outreach-agent` fail-closes on the same ASCII class via
  `IANA_TIMEZONE_SHAPE_PATTERN` / `isIanaTimezoneShape` before Intl, and caps
  optional timezone input at 64.

## Out of scope

- Does **not** rewrite `public.restaurants.timezone` (open #462).
- Does **not** rewrite outreach email / URL CHECKs (open #420 / #421 / #443).
- Does **not** touch `miseValidation.ts` (open #462 exports the restaurant
  client allowlist).
- Does **not** invent campaign update RPCs; only `create_campaign` writes
  timezone today.

## Verification

- `npm run typecheck`
- focused `tests/outreachCampaignTimezoneLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)

## Compose

Alone on main. Timestamp after MISE-005BB (#462). Prefer after #462 lands so
restaurant + outreach timezone CHECKs share the same IANA ASCII class on main.
