# Inventory on-hand valuation (2026-08-30)

## Completed
- Added `computeInventoryValuation` / `estimateInventoryDollarsAtRisk` in
  `services/domain/inventoryValuation.ts` (projected qty × positive unit cost;
  unpriced items excluded; no invented dollars).
- Inventory hub surfaces on-hand value under health, with EN/ES/zh-Hans copy and
  optional Orders deep-link when priced Critical/Low exposure exists.
- Daily Report stock dollars-at-risk now shares the same estimator.

## Verification
- `npx tsx --test tests/inventoryValuation.test.ts`
- `npx tsx --test tests/dailyOpsReport.test.ts`
- `npm run typecheck`
- `npm test` (focused + suite as reported in PR)

## Non-goals
- Does not add unit-cost editing (see open #231).
- Does not change recommendation quantities or purchase authority.
- Does not overlap open stacks #132–#279 / #147.
