# MISE-005L: pin outreach email_normalized unique keys to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-outreach-email-normalized-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.outreach_leads` and `public.outreach_suppressions` store

```sql
email_normalized text generated always as (lower(btrim(email))) stored
```

with `UNIQUE(email_normalized)`. `lower()` follows database `LC_CTYPE`. This
cluster runs libc `en_US.UTF-8`. MISE-005A proved `lower()` differs between
`en_US.UTF-8` and `C` for accented uppercase input; MISE-005B–005K re-pinned
restaurant-tenant discovery keys and cntrl CHECKs the same way.

These generated unique keys are a restore hazard: a glibc/ICU/ctype change that
moved recomputed keys would make `pg_dump`/`restore` abort on lead or
suppression rows the source accepted — breaking outreach dedupe and unsubscribe
continuity. Outreach tables are non-tenant service-only, but they share the
production database restore path.

## Change

- Additive migration `20260926061000_mise_005l_outreach_email_normalized_locale_pin.sql`
  - Recreate `email_normalized` as `lower(btrim(email) COLLATE "C") COLLATE "C"`
  - Reattach `outreach_leads_email_check` with `email collate "C" ~ ...[[:space:]]...`
  - Preserve UNIQUE on both leads and suppressions
- Domain helper `normalizeOutreachEmail` now ASCII-space trims and A-Z folds only
  (no Unicode `toLowerCase`, no accent-fold)
- Outreach agent `requireEmail` / suppression lookup use the shared helper
- Source-pin Jest + pgTAP fixtures committed

Email discovery intentionally does **not** accent-fold: `Café@x` must not become
`cafe@x`.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#419
- `realtime.to_regrole` ACL/volatility audit
- Inventing MOQ / lead_time / expiration
- Contested receive / `record_supplier_delivery` size checks
- Restaurant-tenant inventory/POS cntrl leftover preflights
