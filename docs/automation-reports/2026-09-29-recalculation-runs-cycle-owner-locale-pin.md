# MISE-005CM: pin recalculation_runs.cycle and monitoring_owner CHECKs to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-recalculation-cycle-owner-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `recalculation_runs.cycle` and
`recalculation_runs.monitoring_owner` allowlists with the exact-token contract
plus ASCII shape under COLLATE `"C"`:

```sql
cycle in ('daily_open', 'mid_shift', 'close')
and cycle collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

monitoring_owner in ('member', 'manager', 'owner_admin')
and monitoring_owner collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/recalculationSchedule.ts`,
`services/domain/recalculationRunTransport.ts`):

- cycle: `daily_open`, `mid_shift`, `close`
- monitoring_owner: `member`, `manager`, `owner_admin`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`recalculation_runs` keys (#452), `job_name` (#453), and `status` (#496), but
leave `cycle` and `monitoring_owner` on bare IN only. Without a dedicated
COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
schedule-identity bytes the restored C-locale path would refuse — or the
reverse — breaking recalculation schedule continuity across restore.

## Scope

- CHECK-only on `public.recalculation_runs.cycle` and `monitoring_owner`
- Does **not** rewrite `public.record_recalculation_run`
- Does **not** touch `recalculation_runs_failure_check`
- Does **not** touch status (#496), key (#452), or job_name (#453) pins
- Does **not** touch `restaurant_tasks.status` (#498) or
  `supplier_orders.status` (#497)
- Alone on main OK; timestamp after #498 (`20260930010000`)

## Verification

- `npm run typecheck`
- focused `tests/recalculationRunsCycleOwnerLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 22 from 22 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930010000_mise_005cm_recalculation_runs_cycle_owner_locale_pin.sql`
- `supabase/tests/database/recalculation_runs_cycle_owner_locale_pin.test.sql`
- `tests/recalculationRunsCycleOwnerLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-recalculation-runs-cycle-owner-locale-pin.md`
