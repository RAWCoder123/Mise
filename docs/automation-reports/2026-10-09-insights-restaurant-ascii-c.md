# MISE-005LJ: pin Insights restaurant workspace to ASCII C

Date: 2026-10-09  
Base: `origin/main` @ `78da737`

## Finding

Unicode `restaurantId.trim()` on Insights application sales-trend and
sales-analytics entry points invented a workspace identity from NBSP/em-space
padding before planning-data fetch and restaurant-scope validation.

## Change

- Added `services/domain/insightsRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed application `fetchInsightsSalesTrend` and
  `fetchInsightsSalesAnalytics` restaurant workspace through
  `requireCanonicalInsightsWorkspaceId` (preserves
  `Missing restaurant workspace.`).
- Preserved non-UUID demo workspace tokens; left sibling restaurant tips and
  domain `salesTrends` / `insightsSalesAnalytics` builders for separate PRs.

## Verification

- Focused: `tests/insightsRestaurantAsciiC.test.ts`
- Regression: `tests/insightsSalesAnalytics.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static` / `npm run security:backend`

## Do not

- Re-tip this Insights restaurant_id path after merge.
- Bundle sibling restaurant-workspace tips in the same PR.
- Add a UUID shape requirement on this restaurant_id path.
