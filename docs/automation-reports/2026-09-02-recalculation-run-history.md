# Recalculation run history browse — 2026-09-02

## Completed
- Read-only More hub browse for append-only `recalculation_runs`
- Domain filter/sort for Attention (failed / dead-lettered / timed out) vs All
- Presentation row labels for cycle, status, attempt budget, and monitoring owner
- Home dead-letter StatusNotice CTA retargeted from Activity to this ledger
- Demo seeds include one dead-lettered opening run plus mid-shift success and close failure
- EN / ES / zh-Hans copy; route smoke entry; hub fail-closed pins

## Verification
- `npm run typecheck`
- focused tests: recalculationHistory, hubLoadState, clientTenantSafety
- `npm run security:static`
- `npm run design:static`
- full `npm test`

## Classification
Controlled pilot-ready codebase; this slice closes the “Home warns about dead letters but dumps into mixed Activity” gap without changing schedule or executor semantics.
