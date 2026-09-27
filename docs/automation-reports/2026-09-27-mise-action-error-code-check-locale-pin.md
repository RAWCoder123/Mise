# MISE-005AO: mise_actions.error_code CHECK locale pin

Date: 2026-09-27  
Branch: `cursor/mise-action-error-code-check-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.mise_actions.error_code` is unconstrained text on main. Failure writers
still gate with bare:

```sql
p_error_code !~ '^[a-z0-9_]{1,80}$'
```

MISE-005AG (#441) pins that writer under `COLLATE "C"`, and MISE-005AE (#439)
pins `private.gmail_safe_error_code`, but left the durable column without a
matching table CHECK. Under `LC_CTYPE` drift, dump/restore and writer↔table
continuity can disagree for supplier-send / automation failure evidence.

## Fix

Additive migration
`20260927120000_mise_005ao_mise_action_error_code_check_locale_pin.sql`
attaches:

```sql
error_code is null
or error_code collate "C" ~ '^[a-z0-9_]{1,80}$'
```

Null remains legal for successful actions.

## Out of scope

- Does not rewrite `private.service_record_mise_action_failure` (open #441)
- Does not rewrite `private.gmail_safe_error_code` (open #439)
- Does not rewrite finding `policy_version` / `finding_id` (#440 / #442)
- Does not reattach operational reason_code CHECKs (#448)
- Does not change domain error-code allowlists (ASCII snake_case already)

## Compose

Compose-safe alone on main. CHECK-only; no function rewrite. Prefer after
MISE-005AG (#441) so writer + table pins agree; timestamp after MISE-005AN
(#448). Compatible with open #441 because that path owns the writer RPC, not
this table constraint.

## Verification

- `npm run typecheck`
- focused `tests/miseActionErrorCodeCheckLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
