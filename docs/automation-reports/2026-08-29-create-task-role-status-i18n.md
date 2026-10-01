# Create Task role/status + Daily Report miseStatus i18n (2026-08-29)

Branch: `cursor/mise-create-task-role-status-i18n`
Base: `origin/main` @ `20b28e5`

## Problem
Create Task assignee ChoiceRows dumped raw `member.role` enums (`owner|admin|manager|staff`).
Prerequisite ChoiceRows dumped raw `task.status` enums (`waiting|blocked|in_progress|…`).
Daily Report closeout badge showed freeform English `miseStatus` (including the domain monitoring sentence and demo Ready/Watch/Attention fixtures).

## Fix
- `services/presentation/teamMemberRoleLabel.ts` — reuse `settings.role.*`
- `services/presentation/restaurantTaskStatusLabel.ts` — `operatorTasks.status.*`; unknown → underscore-split fallback
- `services/presentation/miseStatusLabel.ts` — allowlist Ready/Watch/Attention + exact monitoring sentence; unknown shown as-is
- Wire `app/more/create-task.tsx` and `app/more/daily-report.tsx`
- Catalog EN/ES/zh-Hans keys

## Tests
typecheck; restaurantTaskStatusLabel + localization; npm test; design:static; security:static
