# MISE-005CO: pin restaurant_tasks.origin and required_role CHECKs to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-tasks-origin-role-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_tasks.origin` and
`restaurant_tasks.required_role` allowlists with the exact-token contract plus
ASCII shape under COLLATE `"C"`:

```sql
origin in ('human', 'mise', 'automated', 'approval', 'verification')
and origin collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

required_role in ('member', 'manager', 'owner_admin')
and required_role collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/restaurantTasks.ts`):

- origin: `human`, `mise`, `automated`, `approval`, `verification`
- required_role: `member`, `manager`, `owner_admin`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pin #498 covers
`restaurant_tasks.status` only. Without a dedicated COLLATE C shape CHECK on
origin and required_role, dump/restore under LC_CTYPE drift can accept
task-authority bytes the restored C-locale path would refuse — or the reverse —
breaking provenance and role gates across restore.

## Scope

- CHECK-only on `public.restaurant_tasks.origin` and `required_role`
- Does **not** rewrite create/complete/reopen task RPCs
- Does **not** touch status (#498), client_task_id (#455), priority,
  timing_bucket, operational_category, verification_method, or service_window
- Does **not** touch POS/email connection status (#500)
- Alone on main OK; timestamp after #500 (`20260930030000`)

## Verification

- `npm run typecheck`
- focused `tests/restaurantTasksOriginRoleLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 24 from 24 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930030000_mise_005co_restaurant_tasks_origin_role_locale_pin.sql`
- `supabase/tests/database/restaurant_tasks_origin_role_locale_pin.test.sql`
- `tests/restaurantTasksOriginRoleLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-tasks-origin-role-locale-pin.md`
