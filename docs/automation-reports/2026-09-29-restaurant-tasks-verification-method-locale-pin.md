# MISE-005CR: pin restaurant_tasks.verification_method CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-restaurant-tasks-verification-method-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `restaurant_tasks.verification_method` allowlist
(`none` / `checklist` / `photo` / `count` / `receipt` / `manager_review` /
`source_state`) with the exact-token contract plus ASCII shape under COLLATE
`"C"`:

```sql
verification_method in (
  'none',
  'checklist',
  'photo',
  'count',
  'receipt',
  'manager_review',
  'source_state'
)
and verification_method collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/restaurantTasks.ts` verification method
set and shared-task RPCs):

- `none` — no completion evidence required
- `checklist` — checklist evidence
- `photo` — photo evidence
- `count` — inventory count evidence
- `receipt` — receipt evidence
- `manager_review` — manager review evidence
- `source_state` — source-state evidence

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`restaurant_tasks.status` (#498), `origin`/`required_role` (#501),
`priority`/`timing_bucket` (#502), and `operational_category` (#503), but leave
`verification_method` on bare IN only. Without a dedicated COLLATE C shape
CHECK, dump/restore under LC_CTYPE drift can accept verification-method bytes
the restored C-locale path would refuse — or the reverse — breaking evidence
requirements and completion consistency across restore.

## Scope

- CHECK-only on `public.restaurant_tasks.verification_method`
- Does **not** rewrite create/complete/reopen task RPCs
- Does **not** touch `restaurant_tasks_verification_check` (required/method pairing)
- Does **not** touch the completion consistency CHECK
- Does **not** touch `client_task_id` (#455)
- Does **not** touch `status` (#498), `origin`/`required_role` (#501),
  `priority`/`timing_bucket` (#502), or `operational_category` (#503)
- Does **not** touch `service_window`
- Alone on main OK; timestamp after #503 (`20260930060000`)

## Verification

- `npm run typecheck` pass
- focused `tests/restaurantTasksVerificationMethodLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (withTimeout baseline; includes
  the three new MISE-005CR static checks)
- pgTAP fixture committed (plan 15 from 15 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930060000_mise_005cr_restaurant_tasks_verification_method_locale_pin.sql`
- `supabase/tests/database/restaurant_tasks_verification_method_locale_pin.test.sql`
- `tests/restaurantTasksVerificationMethodLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-restaurant-tasks-verification-method-locale-pin.md`
