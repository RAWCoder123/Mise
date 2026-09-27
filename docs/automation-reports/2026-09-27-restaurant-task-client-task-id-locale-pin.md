# MISE-005AU: pin restaurant_tasks.client_task_id CHECK to COLLATE C

Date: 2026-09-27
Branch: `cursor/mise-restaurant-task-client-task-id-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the length-only CHECK on `public.restaurant_tasks.client_task_id`:

- before: `length(trim(client_task_id)) between 1 and 200`
- after: `client_task_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'`

## Writer vocabulary

Confirmed ASCII mints:

- UI (`app/more/create-task.tsx`):
  `restaurant-task:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
- pgTAP / unit fixtures: `task-count-chicken`, `demo-shared-count`,
  `client-task-1`

## Scope

- CHECK-only; does **not** rewrite `public.create_restaurant_task`
- Does **not** touch finding-decision identity (#454), inventory_events
  identity (#375), or recalculation job_name (#453)
- Alone on main OK; timestamp after #454

## Verification

- `npm run typecheck`
- focused `tests/restaurantTaskClientTaskIdLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260927180000_mise_005au_restaurant_task_client_task_id_locale_pin.sql`
- `supabase/tests/database/restaurant_task_client_task_id_locale_pin.test.sql`
- `tests/restaurantTaskClientTaskIdLocalePin.test.ts`
- `docs/automation-reports/2026-09-27-restaurant-task-client-task-id-locale-pin.md`
