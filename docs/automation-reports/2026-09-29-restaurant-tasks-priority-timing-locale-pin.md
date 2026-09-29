# MISE-005CP: pin restaurant_tasks.priority and timing_bucket CHECKs to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-tasks-priority-timing-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_tasks.priority` and
`restaurant_tasks.timing_bucket` allowlists with the exact-token contract plus
ASCII shape under COLLATE `"C"`:

```sql
priority in ('urgent', 'high', 'normal', 'low')
and priority collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

timing_bucket in ('now', 'up_next', 'later')
and timing_bucket collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/restaurantTasks.ts`):

- priority: `urgent`, `high`, `normal`, `low`
- timing_bucket: `now`, `up_next`, `later`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`restaurant_tasks.status` (#498) and origin/required_role (#501). Without a
dedicated COLLATE C shape CHECK on priority and timing_bucket, dump/restore
under LC_CTYPE drift can accept task-schedule bytes the restored C-locale path
would refuse — or the reverse — breaking urgency ranking and Today queue
placement across restore.

## Scope

- CHECK-only on `public.restaurant_tasks.priority` and `timing_bucket`
- Does **not** rewrite create/complete/reopen task RPCs
- Does **not** touch status (#498), origin/required_role (#501),
  client_task_id (#455), operational_category, verification_method, or
  service_window
- Alone on main OK; timestamp after #501 (`20260930040000`)

## Verification

- `npm run typecheck`
- focused `tests/restaurantTasksPriorityTimingLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 23 from 23 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930040000_mise_005cp_restaurant_tasks_priority_timing_locale_pin.sql`
- `supabase/tests/database/restaurant_tasks_priority_timing_locale_pin.test.sql`
- `tests/restaurantTasksPriorityTimingLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-tasks-priority-timing-locale-pin.md`
