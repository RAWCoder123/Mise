# MISE-005MS salesTrends restaurant workspace ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-sales-trends-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `buildRecordedSalesTrend` normalized `restaurantId` with Unicode
`String.prototype.trim()`. NBSP (`U+00A0`) or em-space (`U+2003`) padding around
a valid restaurant workspace token would still normalize to that token, inventing
an exact tenant match against unpadded `sale.restaurant_id` rows before the
recorded sales trend was aggregated.

## Change

- Added `services/domain/salesTrendsRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed `buildRecordedSalesTrend` through
  `requireCanonicalSalesTrendsWorkspaceId`.
- Preserved distinct require message `Sales trend requires a restaurant.` for
  focused inventing proofs (separate from Insights application tip #740
  `Missing restaurant workspace.`).
- Left application Insights Unicode trim paths for open tip #740.
- Left sibling domain restaurant workspace Unicode trims on `supplierSpend`,
  `wasteAnalysis`, and `inventoryCountAuthority` for later tips.
- Non-UUID demo tokens (e.g. `restaurant_a`) intentionally preserved; no UUID
  shape gate on this path.

## Merge note

Alone-OK relative to open stacks through #774. Does not share identity modules
with Insights restaurant (#740) or sibling domain restaurant tips. Drop any
assertion that `buildRecordedSalesTrend` still uses Unicode `restaurantId.trim()`
or silently returns `[]` for empty/invalid workspace tokens; this tip owns that
domain restaurant workspace identity and fails closed with
`Sales trend requires a restaurant.`

## Verification

- `tests/salesTrendsRestaurantAsciiC.test.ts`: focused inventing proofs
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
