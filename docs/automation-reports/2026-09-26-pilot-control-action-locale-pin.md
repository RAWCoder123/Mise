# MISE-005Y: pilot control action/reason locale pin

Date: 2026-09-26  
Branch: `cursor/mise-pilot-control-action-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.service_apply_pilot_operational_control` (the service-only pilot
kill-switch mutator) still folded action and reason_code with bare
`lower(btrim(...))`, then gated the reason with bare
`normalized_reason !~ '^[a-z0-9_]{3,64}$'`. `lower()` and POSIX `[a-z]` follow
database `LC_CTYPE`. MISE-005A proved locale drift on this cluster; later
MISE-005 tips pinned supplier-send / POS / purchase / outreach identity paths,
but left this service-role control boundary on bare lower/btrim.

Under ctype drift, the same service bytes could fail the ASCII allowlist or
reason-shape gate (or accept bytes a restored C-locale gate would refuse) and
break exact-retry continuity against prior immutable evidence for the same
`request_id`.

## Fix

Additive migration
`20260926190000_mise_005y_pilot_control_action_locale_pin.sql` rewrites
`public.service_apply_pilot_operational_control` so:

```sql
normalized_action text := pg_catalog.lower(
  pg_catalog.btrim(coalesce(p_action, '')) collate "C"
) collate "C";
normalized_reason text := pg_catalog.lower(
  pg_catalog.btrim(coalesce(p_reason_code, '')) collate "C"
) collate "C";
-- ...
if normalized_reason collate "C" !~ '^[a-z0-9_]{3,64}$' then
```

EXECUTE remains revoked from public/anon/authenticated; granted to
`service_role` only.

## Out of scope

- Does not rewrite `public.service_set_system_operational_mode`
- Does not rewrite `private.build_pilot_operational_control_state`
- Does not alter restaurant/system operational control tables

## Compose

Must apply after MISE-PILOT-001 atomic controls. Compose-safe alone on main
(`service_apply_pilot_operational_control` unreplaced since pilot-001).
Timestamp after MISE-005X.

## Verification

- `npm run typecheck`
- focused `tests/pilotControlActionLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
