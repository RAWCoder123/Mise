# MISE-005DE: pin system_operational_controls.operational_mode CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-system-operational-mode-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `system_operational_controls.operational_mode`
allowlist with the exact-token contract plus ASCII shape under COLLATE
`"C"`:

```sql
operational_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')
and operational_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`service_set_system_operational_mode`, emergency-mode
enforcement, provider kill-switch gates, and the table CHECK from
operational_data_foundation_inventory_ledger):

- `normal` — ordinary authenticated mutations allowed
- `read_only` — authenticated writes blocked
- `integrations_paused` — provider claims and sync paused
- `emergency` — emergency halt of authenticated mutations

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII
shape gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #434 covers
the `reason_code` shape on `service_set_system_operational_mode`, but leaves
the `operational_mode` table CHECK on bare IN only. Without a dedicated
COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
emergency-mode vocabulary bytes the restored C-locale path would refuse —
or the reverse — breaking operational-mode authority across restore.

Note: `restaurant_operational_controls` has no `operational_mode` column;
mode authority is system-scoped only.

## Scope

- CHECK-only on `public.system_operational_controls.operational_mode`
- Does **not** rewrite `service_set_system_operational_mode` (#434)
- Does **not** touch `ordering_policy` CHECKs
- Does **not** touch `restaurant_operational_controls`
- Does **not** touch `private.operational_mode_changes`
- Does **not** touch `purchase_orders.status` or other bare-IN vocabularies
- Alone on main OK; timestamp after #516 (`20260930180000`)

## Verification

- `npm run typecheck` pass
- focused `tests/systemOperationalModeLocalePin.test.ts` 3/3 pass
- `npm test` 686 pass / 0 fail / 0 cancelled
- pgTAP fixture committed (plan 12 from 12 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930190000_mise_005de_system_operational_mode_locale_pin.sql`
- `supabase/tests/database/system_operational_mode_locale_pin.test.sql`
- `tests/systemOperationalModeLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-system-operational-mode-locale-pin.md`
