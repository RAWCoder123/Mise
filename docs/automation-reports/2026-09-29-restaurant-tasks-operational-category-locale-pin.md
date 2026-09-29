# MISE-005CQ: pin restaurant_tasks.operational_category CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-tasks-operational-category-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_tasks.operational_category` allowlist
(`inventory` / `orders` / `prep` / `service` / `team` / `cleaning` /
`maintenance` / `deliveries` / `closing` / `integrations` / `other`) with the
exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
operational_category in (
  'inventory',
  'orders',
  'prep',
  'service',
  'team',
  'cleaning',
  'maintenance',
  'deliveries',
  'closing',
  'integrations',
  'other'
)
and operational_category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/restaurantTasks.ts` category set and
shared-task RPCs):

- `inventory` — stock counts, transfers, adjustments
- `orders` — purchasing and supplier work
- `prep` — mise en place and prep lists
- `service` — service-period operational work
- `team` — staffing and assignment work
- `cleaning` — sanitation routines
- `maintenance` — equipment and facility work
- `deliveries` — receiving and delivery checks
- `closing` — end-of-day closing routines
- `integrations` — POS/email reconnect and sync recovery
- `other` — catch-all category

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`restaurant_tasks.status` (#498), `origin`/`required_role` (#501), and
`priority`/`timing_bucket` (#502), but leave `operational_category` on bare IN
only. Without a dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE
drift can accept task-category bytes the restored C-locale path would refuse —
or the reverse — breaking category grouping and Today filters across restore.

## Scope

- CHECK-only on `public.restaurant_tasks.operational_category`
- Does **not** rewrite create/complete/reopen task RPCs
- Does **not** touch the completion consistency CHECK
- Does **not** touch `client_task_id` (#455)
- Does **not** touch `status` (#498), `origin`/`required_role` (#501), or
  `priority`/`timing_bucket` (#502)
- Does **not** touch `verification_method` or `service_window`
- Does **not** touch `autonomy_configuration.operational_category`
- Alone on main OK; timestamp after #502 (`20260930050000`)

## Verification

- `npm run typecheck` pass
- focused `tests/restaurantTasksOperationalCategoryLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CQ static checks)
- pgTAP fixture committed (plan 19 from 19 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930050000_mise_005cq_restaurant_tasks_operational_category_locale_pin.sql`
- `supabase/tests/database/restaurant_tasks_operational_category_locale_pin.test.sql`
- `tests/restaurantTasksOperationalCategoryLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-tasks-operational-category-locale-pin.md`
