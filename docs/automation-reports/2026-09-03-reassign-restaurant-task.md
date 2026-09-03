# Reassign open restaurant task assignee (2026-09-03)

Base: `origin/main` @ `20b28e5`. Tip: this automation run.

## Problem
Shared restaurant tasks could only set `assignee_user_id` at create time. Wrong or
stale assignees left staff blocked by the assignee gate with no manager path to
redirect open operating-plan work (short of cancel, which is a separate stack).

## Fix
- Additive migration `20260903201000_reassign_restaurant_task.sql`:
  `reassign_restaurant_task` + `task_reassigned` activity allowlist entry
  (also preserves `task_cancelled` for ordered merge with #378).
- Manager+ only; open statuses only; idempotent same-assignee replay;
  membership/`required_role` still enforced by existing assignee trigger.
- Domain/application/demo/supabase repository wiring.
- Task detail Reassign UI with eligible teammates (EN/ES/zh-Hans).

## Verification
- `npm run typecheck` passed
- `npm run security:static` + `security:backend` + `design:static` passed
- Focused: restaurantTasks / restaurantTasksRepository / reassign migration /
  sharedRestaurantTasksMigration
- `npm test` 636 passed / 0 failed / 7 cancelled
- `npm run supabase:test` deferred (no Docker in this environment)

## Notes
Does not invent MOQ/lead_time/expiration. Independent of cancel (#378). Next:
enforce `reorder_threshold <= par_level`, or land open stacks.
