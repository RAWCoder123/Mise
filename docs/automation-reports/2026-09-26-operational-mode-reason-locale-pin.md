# MISE-005Z: operational mode reason_code locale pin

Date: 2026-09-26  
Branch: `cursor/mise-operational-mode-reason-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.service_set_system_operational_mode` (the service-only system
operational-mode mutator) still gated reason_code with bare
`p_reason_code !~ '^[a-z0-9_]{3,64}$'`. POSIX `[a-z]` follows database
`LC_CTYPE`; MISE-005A proved locale drift on this cluster.

MISE-005Y pinned the sibling pilot kill-switch mutator, but left this
emergency-mode transition path on an unpinned reason-code class check. Under
ctype drift, the same service bytes could fail the ASCII allowlist (or accept
bytes a restored C-locale gate would refuse) and break exact-retry continuity
against prior immutable evidence for the same `request_id`.

## Fix

Additive migration
`20260926200000_mise_005z_operational_mode_reason_locale_pin.sql` rewrites
`public.service_set_system_operational_mode` so the reason shape check uses C
locale:

```sql
if p_reason_code is null or p_reason_code collate "C" !~ '^[a-z0-9_]{3,64}$' then
```

No lower/btrim was added: the original contract stores the exact supplied
reason_code after the shape gate, and callers already pass ASCII lowercase
codes. EXECUTE remains revoked from public/anon/authenticated; granted to
`service_role` only.

## Out of scope

- Does not rewrite `service_apply_pilot_operational_control`
- Does not alter `private.operational_mode_changes` or control tables
- Does not change authenticated mutation blockers for read_only/emergency

## Compose

Must apply after `enforce_emergency_operational_mode`. Compose-safe alone on
main (`service_set_system_operational_mode` unreplaced since that migration).
Timestamp after MISE-005Y (#433).

## Verification

- `npm run typecheck`
- focused `tests/operationalModeReasonLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
