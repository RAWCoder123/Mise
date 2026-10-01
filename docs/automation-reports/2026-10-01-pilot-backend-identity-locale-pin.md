# MISE-005ED: pin pilot backend_identity CHECK to COLLATE C

Date: 2026-10-01
Branch: `cursor/mise-pilot-backend-identity-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-equality `private.pilot_operational_control_changes.backend_identity`
CHECK with the exact equality contract plus ASCII shape under COLLATE `"C"`:

```sql
backend_identity = 'service_role_rpc'
and backend_identity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (table default and CHECK from `mise_pilot_001_atomic_controls`;
`service_apply_pilot_operational_control` omits the column and relies on the
default):

- `service_role_rpc` — evidence row authored through the service-role RPC path

Exact equality is preserved; this tip adds the COLLATE C ASCII shape gate
alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #541 covers
`requested_action` and #536 covers `control_domain` on the same evidence table,
but both left `backend_identity` on bare equality. Without a dedicated COLLATE C
shape CHECK, dump/restore under LC_CTYPE drift can accept pilot backend_identity
vocabulary bytes the restored C-locale path would refuse — or the reverse —
breaking pilot control evidence continuity across restore.

## Scope

- CHECK-only on `private.pilot_operational_control_changes.backend_identity`
- Does **not** rewrite `service_apply_pilot_operational_control` (#433)
- Does **not** touch `requested_action` (#541)
- Does **not** touch `control_domain` (#536)
- Does **not** touch `reason_code` (#448/#434)
- Does **not** touch `system_operational_controls.operational_mode` (#517)
- Does **not** touch `operational_mode_changes` prior/next (#540)
- Alone on main OK; timestamp after #541 (`20261001070000`)

## Verification

- `npm run typecheck` pass
- focused `tests/pilotBackendIdentityLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled
- pgTAP fixture committed (plan 9 from 9 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20261001080000_mise_005ed_pilot_backend_identity_locale_pin.sql`
- `supabase/tests/database/pilot_backend_identity_locale_pin.test.sql`
- `tests/pilotBackendIdentityLocalePin.test.ts`
- `docs/automation-reports/2026-10-01-pilot-backend-identity-locale-pin.md`
