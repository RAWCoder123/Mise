# MISE-005AE: gmail_safe_error_code locale pin

Date: 2026-09-27  
Branch: `cursor/mise-gmail-safe-error-code-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.gmail_safe_error_code` still gated provider failure codes with bare
`p_error_code !~ '^[a-z0-9_]{1,80}$'`. POSIX `[a-z0-9_]` follows database
`LC_CTYPE`; MISE-005A proved locale drift on this cluster.

This helper is the shared ASCII allowlist for Gmail and Square OAuth fail,
connection-state, supplier-send fail, and Square sync-failure RPCs. Accepted
codes are stored on durable failure rows. Under ctype drift, Edge→RPC failure
recording and dump/restore could disagree on the same provider bytes.

## Fix

Additive migration
`20260927000200_mise_005ae_gmail_safe_error_code_locale_pin.sql` rewrites
`private.gmail_safe_error_code` so the shape check uses C locale:

```sql
if p_error_code is null or p_error_code collate "C" !~ '^[a-z0-9_]{1,80}$' then
```

EXECUTE remains revoked from public/anon/authenticated/service_role — the
helper stays internal to private SECURITY DEFINER callers. No caller rewrite
is required.

## Out of scope

- Does not rewrite `private.service_record_mise_action_failure` (same regex
  class on the separate mise_actions path)
- Does not rewrite `operational_finding_decisions.policy_version`
- Does not rewrite complete-oauth or Edge Function bodies

## Compose

Must apply after `gmail_backend_oauth_delivery`. Compose-safe alone on main
(`gmail_safe_error_code` unreplaced since that migration). Timestamp after
MISE-005AD (#438).

## Verification

- `npm run typecheck`
- focused `tests/gmailSafeErrorCodeLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
