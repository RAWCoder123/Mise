# MISE-005AN: reason_code CHECK locale pin

Date: 2026-09-27  
Branch: `cursor/mise-reason-code-check-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.operational_mode_changes.reason_code` and
`private.pilot_operational_control_changes.reason_code` still accepted bare
class matches:

```sql
reason_code ~ '^[a-z0-9_]{3,64}$'
```

MISE-005Z (#434) and MISE-005Y (#433) pin the matching writer gates with
`COLLATE "C"`, but left the durable table CHECKs unpinned. Under `LC_CTYPE`
drift, dump/restore and writer↔table continuity can disagree for kill-switch
and emergency-mode evidence.

## Fix

Additive migration
`20260927110000_mise_005an_reason_code_check_locale_pin.sql` reattaches:

- `operational_mode_changes_reason_code_check`
- `pilot_operational_control_changes_reason_code_check`

each as:

```sql
reason_code collate "C" ~ '^[a-z0-9_]{3,64}$'
```

## Out of scope

- Does not rewrite `service_set_system_operational_mode` (open #434)
- Does not rewrite `service_apply_pilot_operational_control` (open #433)
- Does not rewrite finding `policy_version` / `finding_id` (#440 / #442)
- Does not rewrite mise_action failure `error_code` (#441)
- Does not change domain reason-code allowlists (ASCII snake_case already)

## Compose

Compose-safe alone on main. CHECK-only; no function rewrite. Prefer after
MISE-005Y (#433) and MISE-005Z (#434) so writer + table pins agree; timestamp
after MISE-005AM (#447). Compatible with open #433/#434 because those paths
own the writer RPCs, not these table constraints.

## Verification

- `npm run typecheck`
- focused `tests/reasonCodeCheckLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
