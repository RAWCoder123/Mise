# MISE-005K: pin supplier_recipients name/email cntrl CHECKs to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-supplier-recipients-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.supplier_recipients` still used bare POSIX `[[:cntrl:]]` on
`supplier_recipients_name_bounds_check` and
`supplier_recipients_email_format_check`. Those character classes follow
database `LC_CTYPE`. MISE-005A already proved locale drift on this cluster
for `lower()` / `[[:alnum:]]`; MISE-005B through MISE-005J re-pinned sibling
text identity columns with `collate "C" !~ '[[:cntrl:]]'`.

`supplier_name` and `email` are the durable supplier-send To identity and the
presentation snapshot used by the recipient directory and send-envelope
approval. If a glibc/ICU change reclassified a stored byte under bare
`[[:cntrl:]]`, `pg_dump`/`restore` could reject recipient rows the source
accepted — breaking send readiness and To-address continuity.

## Change

- Additive migration `20260926050500_mise_005k_supplier_recipients_cntrl_locale_pin.sql`
  - Reattach `supplier_recipients_name_bounds_check` with
    `supplier_name collate "C" !~ '[[:cntrl:]]'`
  - Reattach `supplier_recipients_email_format_check` with
    `email collate "C" !~ '[[:cntrl:]]'`
  - Preserve length / trim / address-shape contract
- Source-pin + pgTAP fixtures committed
- Client validation already rejects ASCII Cc (`U+0000–U+001F`, `U+007F`);
  source-pin asserts that parity

Does **not** rewrite `upsert_supplier_recipient` or setup-save RPCs so this
composes with open supplier-send and durable-identity stacks. Restore
authority is the CHECK.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#418
- `realtime.to_regrole` ACL/volatility audit
- Inventing MOQ / lead_time / expiration
- Contested receive / `record_supplier_delivery` size checks
- Rewriting recipient upsert RPC cntrl preflights (fail-closed under en_US)
