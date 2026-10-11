# MISE-005MY insightsSalesAnalytics restaurant workspace ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-insights-sales-analytics-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `buildInsightsSalesAnalytics` normalized `restaurantId` with Unicode
`String.prototype.trim()`. NBSP (`U+00A0`) or em-space (`U+2003`) padding around
a valid restaurant workspace token would still normalize to that token, inventing
an exact tenant match against unpadded `sale.restaurant_id` rows before best
sellers, category/weekday/source mix, and units trend were aggregated.

## Change

- Added `services/domain/insightsSalesAnalyticsRestaurantIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `buildInsightsSalesAnalytics` through
  `requireCanonicalInsightsSalesAnalyticsWorkspaceId`.
- Preserved distinct require message
  `Sales analytics requires a restaurant workspace.` for focused inventing
  proofs (separate from Insights application tip #740
  `Missing restaurant workspace.` and salesTrends tip #775
  `Sales trend requires a restaurant.`).
- Left application Insights Unicode trim paths for open tip #740.
- Left sibling domain restaurant workspace Unicode trims on `salesTrends`,
  `supplierReliability`, and `orderAutomation` for their open tips.
- Non-UUID demo tokens (e.g. `restaurant_a`) intentionally preserved; no UUID
  shape gate on this path. Max length 128.

## Merge note

Alone-OK relative to open stacks through #780. Does not share identity modules
with Insights restaurant (#740), salesTrends restaurant (#775), or
supplierReliability restaurant (#780). Drop any assertion that
`buildInsightsSalesAnalytics` still uses Unicode `input.restaurantId.trim()` or
silently returns empty analytics for empty/invalid workspace tokens; this tip
owns that domain restaurant workspace identity and fails closed with
`Sales analytics requires a restaurant workspace.`

When landing alongside #775/#780/#779, keep modules and error contracts separate;
those tips should drop any assertion that domain `insightsSalesAnalytics` still
Unicode-trims `input.restaurantId`.

## Verification

- `tests/insightsSalesAnalyticsRestaurantAsciiC.test.ts`: focused inventing proofs
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
