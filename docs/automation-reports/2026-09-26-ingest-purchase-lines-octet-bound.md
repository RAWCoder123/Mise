# MISE-005G: bound ingest_purchase_lines p_lines with octet_length

Date: 2026-09-26  
Branch: `cursor/mise-ingest-purchase-lines-octet-bound`  
Base: `origin/main` @ `78da737`

## Problem

`public.ingest_purchase_lines` accepted any jsonb array of 1–500 purchase lines
with no byte ceiling. `record_supplier_delivery` already rejects `p_lines`
above 256 KiB. Without the same logical ceiling, a manager-authorized (or
poisoned) ingest can force the SECURITY DEFINER writer to parse and walk an
arbitrarily large jsonb document before per-line field caps apply.

## Change

- Additive migration `20260926011100_mise_005g_ingest_purchase_lines_octet_bound.sql`
  - `CREATE OR REPLACE public.ingest_purchase_lines` with
    `octet_length(p_lines::text) > 262144` fail-closed
  - Dedicated error: `Purchase line payload exceeds the allowed size`
- Domain constants `PURCHASE_LINE_INGEST_MAX_BYTES` / `_MAX_LINES`
- Application preflight before the RPC (fail-closed approx via JSON.stringify)
- Source-pin + pgTAP fixtures

Does **not** rewrite `private.append_purchase_line` (open MISE-006) or
`record_supplier_delivery` (contested receive stacks). Stacks that later
redeclare ingest must preserve this `octet_length` guard.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#414
- Rewriting delivery's `pg_column_size` guard (receive-contested)
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration
