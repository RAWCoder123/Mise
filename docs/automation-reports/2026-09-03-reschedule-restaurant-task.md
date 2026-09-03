# Reschedule open restaurant tasks (2026-09-03)

Branch tip for this automation run. Base: `origin/main` @ `20b28e5`.

## Gap

Shared restaurant-task timing was create-only. Managers could not move an open
task between Now / Up next / Later or set a due date after creation. Cancel
(#378) and reassign (#379) cover other lifecycle gaps but not schedule edits.

## Fix

1. Migration `20260903230000_reschedule_restaurant_task.sql` adds
   manager-only `reschedule_restaurant_task` plus `task_rescheduled` activity
   allowlist entry (preserving prior task event types including cancel/reassign).
2. Domain/application/demo/supabase wiring with idempotent replay and open-task
   gates; completed/cancelled stay fail-closed.
3. Task detail Reschedule UI for managers: timing bucket + optional YYYY-MM-DD
   due date; EN / ES / zh-Hans catalog keys.
4. Static migration pin + domain/demo repository tests; pgTAP coverage for role
   gates, idempotency, clear-due, and tenant isolation.

## Verification

- `npm run typecheck`
- focused reschedule + restaurantTasks tests
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Notes

- Distinct from #378 cancel and #379 reassign.
- Does not invent MOQ, lead time, or expiration.
- Hosted deploy of the additive migration remains an ops step.
- If #378/#379 land after this tip, rebase their activity allowlists to keep
  `task_rescheduled`.
