# Close-cycle reconciliation differentiation

Date: 2026-08-26  
Branch: `cursor/mise-close-cycle-reconciliation`  
Base: `origin/main` @ `20b28e5`

## Problem

Open, mid-shift, and close recalculation cycles shared one identical planning
recompute. The schedule already assigned close to owner/admin accountability for
waste, variance, and carryover stock, but the work itself did not differ.

## Change

1. **Domain** `services/domain/closeReconciliation.ts`
   - Pure `buildCloseReconciliation` from ledger waste/counts and inventory
     stock risk.
   - Missing waste is `incomplete`, never invents zero waste.
   - Material count variance uses existing `reconcileInventoryCount` thresholds.
   - Findings convert to opaque planning insights and merge ahead of open/mid
     insights (cap 8).

2. **Application**
   - `regenerateOperationalSignals(restaurantId, { cycle })` merges close
     findings only for `close`.
   - Ports: open/mid still share one planning memo; close always runs its own
     differentiated pass.

3. **Activity + migration**
   - Demo `fromRecalculationRunActivity` and hosted trigger now emit
     "Closing reconciliation completed" on close success.
   - mid_shift success remains ledger-only.
   - Additive migration `20260826220000_close_cycle_reconciliation_activity.sql`.

## Verification

- `npm run typecheck`
- Targeted tests: closeReconciliation, recalculationPorts, activityEvents,
  recalculationRunLedgerMigration
- `npm test`

## Greptile follow-up (hosted persist + ledger completeness)

1. Hosted `replaceOperationalSignals` now forwards `cycle: "close"` into
   `operational-workflows`. Edge `refresh_signals` recomputes planning signals,
   loads a bounded inventory ledger, merges close findings via
   `enrichInsightsWithCloseReconciliation`, then commits. Close waste / variance /
   carryover insights are no longer discarded on Supabase tenants.
2. Close ledger reads no longer use a 14-day `since` window. They use the same
   2000-row bound as inventory evidence and set `ledgerComplete=false` when the
   ceiling is hit. Incomplete history skips variance math instead of inventing
   blocked or material results.

## Not in this tip

- Unattended machine-runner / cron auth for recalculation
- New insight presentation i18n codes (opaque evidence used intentionally)
- Hosted Docker pgTAP execution in this environment
