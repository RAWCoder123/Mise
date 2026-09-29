# MISE-005CS: pin restaurant_tasks.service_window CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-tasks-service-window-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare nullable-IN `restaurant_tasks.service_window` allowlist
(`before_lunch` / `before_prep` / `before_supplier_cutoff` /
`before_dinner_service` / `during_closing` / `end_of_day` / `custom`, or
null) with the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
service_window is null
or (
  service_window in (
    'before_lunch',
    'before_prep',
    'before_supplier_cutoff',
    'before_dinner_service',
    'during_closing',
    'end_of_day',
    'custom'
  )
  and service_window collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
)
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/restaurantTasks.ts` service window set
and shared-task RPCs):

- `before_lunch` — before lunch service
- `before_prep` — before prep window
- `before_supplier_cutoff` — before supplier order cutoff
- `before_dinner_service` — before dinner service
- `during_closing` — during closing routines
- `end_of_day` — end-of-day wrap-up
- `custom` — explicit custom window bounds
- `null` — no service window

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it for non-null values.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`restaurant_tasks.status` (#498), `origin`/`required_role` (#501),
`priority`/`timing_bucket` (#502), `operational_category` (#503), and
`verification_method` (#504), but leave `service_window` on bare nullable IN
only. Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE
drift can accept service-window bytes the restored C-locale path would refuse
— or the reverse — breaking operating-plan timing across restore.

## Scope

- CHECK-only on `public.restaurant_tasks.service_window`
- Does **not** rewrite create/complete/reopen task RPCs
- Does **not** touch `restaurant_tasks_custom_window_check`
- Does **not** touch `restaurant_tasks_window_check`
- Does **not** touch the completion or verification pairing CHECKs
- Does **not** touch `client_task_id` (#455)
- Does **not** touch `status` (#498), `origin`/`required_role` (#501),
  `priority`/`timing_bucket` (#502), `operational_category` (#503), or
  `verification_method` (#504)
- Alone on main OK; timestamp after #504 (`20260930070000`)

## Verification

- `npm run typecheck` pass
- focused `tests/restaurantTasksServiceWindowLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CS static checks)
- pgTAP fixture committed (plan 16 from 16 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930070000_mise_005cs_restaurant_tasks_service_window_locale_pin.sql`
- `supabase/tests/database/restaurant_tasks_service_window_locale_pin.test.sql`
- `tests/restaurantTasksServiceWindowLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-tasks-service-window-locale-pin.md`
