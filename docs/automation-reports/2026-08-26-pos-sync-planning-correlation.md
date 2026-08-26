# Sync → planning activity correlation (2026-08-26)

Branch: `cursor/mise-product-inspection-bbbb`
Base: `origin/main` @ `20b28e5`

## Closed

- Domain helper `posSyncPlanningSequenceId` matches hosted `sales_imports` activity (`pos-sync:{importId}`).
- `fromPosSyncCompleted` now sets that sequence by default.
- `fromPosPlanningSignalsRefreshed` emits a `forecast_updated` beat on the same sequence after signal refresh.
- Demo Square sync creates an import, rebuilds recommendations/insights, and appends both correlated activity events.
- Hosted `sync-pos-sales` passes `syncImportId` into `refresh_signals`.
- `operational-workflows` appends the planning beat via `service_append_activity_event` only for `refresh_signals` with a valid UUID import id.

## Paths

- `services/domain/activityEvents.ts`
- `services/demo/demoActivity.ts`
- `services/repositories/demoRepository.ts`
- `supabase/functions/sync-pos-sales/index.ts`
- `supabase/functions/operational-workflows/index.ts`
- `tests/activityEvents.test.ts`
- `tests/posSyncPlanningCorrelation.test.ts`

## Conflicts / stacking

- Additive with #185 (planning sync stale state): #185 owns durable planning status; this owns activity causality. Rebase if both edit the sync/refresh try block.
- Does not rewrite recommendation `inventory-order:{itemId}` sequences.
- Does not implement the unattended machine-runner.

## Verification

- `npm run typecheck`
- `npm test` (activity + correlation pins)

## Do not redo

- Silent empty `refresh_signals` body without import causation when a sync import id exists.
- Claiming sync and planning are one story when `sequence_id` differs.
