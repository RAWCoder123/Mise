# Cancel open restaurant tasks (2026-09-03)

Tip: `cursor/mise-product-inspection-7798` @ `56702fb`.
Base: `origin/main` @ `20b28e5`.

## Problem

Shared restaurant tasks already model `cancelled` as a terminal, non-projected
status, but operators had no cancel path. Obsolete assigned work stayed on Today
and the operating plan forever; staff could only fake-complete or abandon.

## Fix

- Additive migration `20260903193000_cancel_restaurant_task.sql`:
  - extend activity event allowlist with `task_cancelled`
  - `cancel_restaurant_task` SECURITY DEFINER RPC (manager+)
  - fail closed when open dependents still require the prerequisite
  - reject cancel of completed work; idempotent replay for already-cancelled
  - optional cancel reason bounded to 500 characters
- Domain normalize/RPC helpers + manager-only `canRestaurantRoleCancelSharedTask`
- Demo and hosted repository parity with auditable activity
- Task detail UI Cancel action (EN / ES / zh-Hans) and cancelled read state

## Verification

- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- focused task/cancel/localization tests: 22/22
- `npm test`: 644 total, 637 pass, 0 fail, 7 cancelled
- `npm run supabase:test` blocked (no Docker in this environment)

## Contested / deferred

- Does not touch soft-load / operatingBrief stacks (#190/#327/#328/#372)
- Does not invent MOQ / lead_time / expiration
- Does not wire modifier planning (#341/#344)
- Deploy additive migration before hosted use
