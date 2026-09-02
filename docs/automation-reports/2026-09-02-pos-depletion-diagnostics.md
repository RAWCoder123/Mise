# POS depletion skip diagnostics (2026-09-02)

## Gap
Operators could see sync “rows imported” and recipe coverage percent, but not a
tenant-safe breakdown of which **today’s** POS sales actually skip inventory
depletion — unverified catalog mappings, missing recipe baselines, incompatible
recipe units, or missing inventory items.

## Slice
- Pure domain classifier `buildPosDepletionDiagnostics` over planning sales
- Application read via existing `fetchPlanningData` (no migration)
- More hub browse screen `/more/pos-depletion` with fail-closed load state
- Compact attention cards on Settings → POS and Settings → Recipes
- EN / ES / zh-Hans copy

## Explicit non-goals
- Hosted SQL skip counters on sync RPCs
- Cash-only / non-itemized Square refunds
- Recipe unit repair mutations (open #297)
- Inventing MOQ / lead_time / expiration

## Proof
- `npm run typecheck`
- Focused: `tests/posDepletionDiagnostics.test.ts`, `tests/posDepletionDiagnosticsUi.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
