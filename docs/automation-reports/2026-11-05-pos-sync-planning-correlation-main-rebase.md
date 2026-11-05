# Sync → planning activity correlation (rebased onto main, 2026-11-05)

Branch: `cursor/mise-pos-sync-planning-correlation-main-rebase`
Base: `origin/main` @ `78da7376`

Supersedes conflicting draft #191 (`cursor/mise-product-inspection-bbbb`) without
wholesale resume of that product-inspection branch. The gap was re-derived against
current main after MISE-004C / MISE-005A.

## Closed

- Domain helper `posSyncPlanningSequenceId` matches hosted `sales_imports` activity
  (`pos-sync:{importId}`).
- `fromPosSyncCompleted` now sets that sequence by default.
- `fromPosPlanningSignalsRefreshed` emits a `forecast_updated` beat on the same
  sequence after signal refresh.
- Demo Square sync creates an import, rebuilds recommendations/insights, and
  appends both correlated activity events.
- Hosted `sync-pos-sales` passes `syncImportId` into `refresh_signals`.
- `operational-workflows` appends the planning beat via
  `service_append_activity_event` only for `refresh_signals` with a valid UUID
  import id.

## Paths

- `services/domain/activityEvents.ts`
- `services/demo/demoActivity.ts`
- `services/repositories/demoRepository.ts`
- `supabase/functions/sync-pos-sales/index.ts`
- `supabase/functions/operational-workflows/index.ts`
- `tests/activityEvents.test.ts`
- `tests/posSyncPlanningCorrelation.test.ts`

## Conflicts / stacking

- Additive with open #185 (planning sync stale state): #185 owns durable planning
  status; this owns activity causality. Rebase if both edit the sync/refresh try
  block.
- Does not rewrite recommendation `inventory-order:{itemId}` sequences.
- Does not implement the unattended machine-runner.
- Prefer landing #1100→#1111 before inventing further migration tips; this tip has
  no migration.

## Verification

- `npm run typecheck`
- focused activity + correlation pins
- `npm test`

## Do not redo

- Silent empty `refresh_signals` body without import causation when a sync import
  id exists.
- Claiming sync and planning are one story when `sequence_id` differs.
- Wholesale resume of `cursor/mise-product-inspection-bbbb` / #191.
