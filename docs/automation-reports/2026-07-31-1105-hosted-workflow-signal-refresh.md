# Hosted workflow signal refresh (2026-07-31)

## Problem
Hosted `save_setup` and `ingest_pos_csv` already refresh operational signals inside Edge (`refreshWithRetry`). The application layer then called `regenerateOperationalSignals()`, which invoked `refresh_signals` again. If that second call failed after a successful write, operators saw a generic setup/import failure even though data had been committed.

## Change
- Add `workflowsRefreshOperationalSignals` on `MiseRepository` (`true` hosted, `false` demo).
- Gate client `regenerateOperationalSignals` after setup snapshot and manual POS CSV ingest on that flag so demo still regenerates locally.

## Verification
- `tests/workflowSignalRefresh.test.ts` static contract.
- `npm run typecheck` and `npm test`.
