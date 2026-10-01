# MISE-005EB: pin operational_mode_changes prior_mode/next_mode CHECKs to COLLATE C

Date: 2026-10-01
Branch: `cursor/mise-operational-mode-changes-prior-next-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `private.operational_mode_changes.prior_mode` and
`next_mode` allowlists with the exact-token contract plus ASCII shape under
COLLATE `"C"`:

```sql
prior_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')
and prior_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

next_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')
and next_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`service_set_system_operational_mode` and the table
CHECKs from `enforce_emergency_operational_mode`):

- `normal` — ordinary authenticated mutations allowed
- `read_only` — authenticated writes blocked
- `integrations_paused` — provider claims and sync paused
- `emergency` — emergency halt of authenticated mutations

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII
shape gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #517 covers
`system_operational_controls.operational_mode` but explicitly left
`private.operational_mode_changes` on bare IN. Open tip #434 covers
`reason_code` shape on the mutator, not these history columns. Without a
dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
prior/next mode vocabulary bytes the restored C-locale path would refuse —
or the reverse — breaking emergency mode-history continuity across restore.

## Scope

- CHECK-only on `private.operational_mode_changes.prior_mode` and `next_mode`
- Does **not** rewrite `service_set_system_operational_mode` (#434)
- Does **not** touch `system_operational_controls.operational_mode` (#517)
- Does **not** touch `reason_code`
- Does **not** touch pilot `requested_action`
- Does **not** touch `restaurant_operational_controls`
- Alone on main OK; timestamp after #539 (`20261001050000`)

## Verification

- `npm run typecheck` (pending)
- focused `tests/operationalModeChangesPriorNextLocalePin.test.ts` (pending)
- `npm test` (pending)
- pgTAP fixture committed (plan 20 from 20 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20261001060000_mise_005eb_operational_mode_changes_prior_next_locale_pin.sql`
- `supabase/tests/database/operational_mode_changes_prior_next_locale_pin.test.sql`
- `tests/operationalModeChangesPriorNextLocalePin.test.ts`
- `docs/automation-reports/2026-10-01-operational-mode-changes-prior-next-locale-pin.md`
