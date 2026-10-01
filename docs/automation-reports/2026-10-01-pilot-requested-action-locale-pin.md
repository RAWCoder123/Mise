# MISE-005EC: pin pilot requested_action CHECK to COLLATE C

Date: 2026-10-01
Branch: `cursor/mise-pilot-requested-action-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `private.pilot_operational_control_changes.requested_action`
allowlist with the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
requested_action in (
  'enable-square-sync',
  'enable-square-webhooks',
  'enable-order-drafting',
  'enable-gmail-delivery',
  'disable-square',
  'disable-order-drafting',
  'disable-gmail-delivery',
  'disable-external',
  'pause-integrations',
  'resume-normal'
)
and requested_action collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`service_apply_pilot_operational_control` and the table
CHECK from `mise_pilot_001_atomic_controls`):

- `enable-square-sync` — enable Square sales sync
- `enable-square-webhooks` — enable Square webhook intake
- `enable-order-drafting` — enable supplier order drafting
- `enable-gmail-delivery` — enable Gmail supplier delivery
- `disable-square` — disable Square sync and webhooks
- `disable-order-drafting` — disable supplier order drafting
- `disable-gmail-delivery` — disable Gmail supplier delivery
- `disable-external` — disable all external integrations
- `pause-integrations` — pause integrations via system_mode
- `resume-normal` — resume normal operational mode

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII
shape gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #536 covers
`control_domain` on the same evidence table but explicitly left
`requested_action` on bare IN. Open tip #540 covers
`operational_mode_changes.prior_mode`/`next_mode`, not this pilot evidence
column. Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE
drift can accept pilot requested_action vocabulary bytes the restored C-locale
path would refuse — or the reverse — breaking pilot control evidence continuity
across restore.

## Scope

- CHECK-only on `private.pilot_operational_control_changes.requested_action`
- Does **not** rewrite `service_apply_pilot_operational_control`
- Does **not** touch `control_domain` (#536)
- Does **not** touch `reason_code`
- Does **not** touch `system_operational_controls.operational_mode` (#517)
- Does **not** touch `operational_mode_changes` prior/next (#540)
- Does **not** touch `restaurant_operational_controls`
- Alone on main OK; timestamp after #540 (`20261001060000`)

## Verification

- `npm run typecheck` pass
- focused `tests/pilotRequestedActionLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled
- pgTAP fixture committed (plan 18 from 18 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20261001070000_mise_005ec_pilot_requested_action_locale_pin.sql`
- `supabase/tests/database/pilot_requested_action_locale_pin.test.sql`
- `tests/pilotRequestedActionLocalePin.test.ts`
- `docs/automation-reports/2026-10-01-pilot-requested-action-locale-pin.md`
