# MISE-005CL: pin restaurant_tasks.status CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-tasks-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_tasks.status` allowlist (`waiting` /
`blocked` / `in_progress` / `completed` / `cancelled` / `could_not_verify`)
with the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
status in (
  'waiting',
  'blocked',
  'in_progress',
  'completed',
  'cancelled',
  'could_not_verify'
)
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/restaurantTasks.ts` status set and
shared-task RPCs):

- `waiting` — open task ready for work
- `blocked` — waiting on a prerequisite or gate
- `in_progress` — actively being worked
- `completed` — verified completion recorded
- `cancelled` — intentionally withdrawn
- `could_not_verify` — completion attempted but evidence failed

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`supplier_orders.status` (#497) and `recalculation_runs.status` (#496), but
leave `restaurant_tasks.status` on bare IN only. Without a dedicated COLLATE C
shape CHECK, dump/restore under LC_CTYPE drift can accept task-lifecycle bytes
the restored C-locale path would refuse — or the reverse — breaking task queue
continuity across restore.

## Scope

- CHECK-only on `public.restaurant_tasks.status`
- Does **not** rewrite create/complete/reopen task RPCs
- Does **not** touch the completion consistency CHECK
- Does **not** touch `client_task_id` (#455)
- Does **not** touch `supplier_orders.status` (#497)
- Does **not** touch `recalculation_runs.status` (#496)
- Does **not** touch `inventory_count_sessions.status` (#495)
- Alone on main OK; timestamp after #497 (`20260930000000`)

## Verification

- `npm run typecheck` pass
- focused `tests/restaurantTasksStatusLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CL static checks)
- pgTAP fixture committed (plan 14 from 14 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930000000_mise_005cl_restaurant_tasks_status_locale_pin.sql`
- `supabase/tests/database/restaurant_tasks_status_locale_pin.test.sql`
- `tests/restaurantTasksStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-tasks-status-locale-pin.md`
