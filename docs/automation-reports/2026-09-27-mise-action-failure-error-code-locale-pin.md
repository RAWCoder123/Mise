# MISE-005AG: mise_action failure error_code locale pin

Date: 2026-09-27  
Branch: `cursor/mise-action-failure-error-code-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.service_record_mise_action_failure` still gated mise_actions failure
codes with bare `p_error_code !~ '^[a-z0-9_]{1,80}$'`. POSIX `[a-z0-9_]` follows
database `LC_CTYPE`; MISE-005A proved locale drift on this cluster. MISE-005AE
pinned the shared Gmail/Square helper; this separate mise_actions path remained
bare.

Edge `send-supplier-email` records bounded failure/unverified outcomes through
this RPC. Accepted codes are stored on `mise_actions.error_code` and emitted
into activity events. Under ctype drift, Edge→RPC failure recording and
dump/restore could disagree on the same provider bytes.

## Fix

Additive migration
`20260927000400_mise_005ag_mise_action_failure_error_code_locale_pin.sql`
rewrites `private.service_record_mise_action_failure` so the shape check uses
C locale:

```sql
or p_error_code collate "C" !~ '^[a-z0-9_]{1,80}$'
```

EXECUTE remains revoked from public/anon/authenticated and granted only to
`service_role` on both the private and public wrappers. The public SQL wrapper
is unchanged.

## Out of scope

- Does not rewrite `private.gmail_safe_error_code` (already MISE-005AE)
- Does not rewrite `record_operational_finding_decision` `finding_id` shape
- Does not rewrite Edge Function bodies

## Compose

Must apply after `operational_backend_foundation`. Compose-safe alone on main
(`private.service_record_mise_action_failure` unreplaced since that migration).
Timestamp after MISE-005AF (#440).

## Verification

- `npm run typecheck`
- focused `tests/miseActionFailureErrorCodeLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
