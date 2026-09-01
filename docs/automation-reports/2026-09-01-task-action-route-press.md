# Task action route on Home/Today presses

Date: 2026-09-01  
Branch: `cursor/mise-task-action-route-press`  
Base: `origin/main` @ `20b28e5`

## Problem

Home TopTasks and Today Operating Plan timeline row presses always navigated to
`/tasks/{id}`. Only the Today "Start" button preferred `task.action.route`, so
operators opening an inventory-count or order task from the row landed on the
generic task detail screen instead of the authoritative workflow.

## Change

- Added `resolveOperatingPlanItemActionRoute` in `services/domain/operatingPlan.ts`.
- Today timeline row press and Start both use that helper.
- Home TopTasks presses use `task.action.route` directly.
- Shared restaurant-only plan items still resolve to `/tasks/{id}`.

## Verification

- `npm run typecheck` — pass
- `npm test` — 633 pass / 0 fail / 7 cancelled
- New unit coverage for workflow vs shared-task route resolution

## Out of scope

Ask Mise task chips, create-task recent lists, and inventory purchase-unit
correction remain separate follow-ups.
