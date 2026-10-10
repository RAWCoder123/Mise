# MISE-005MT supplierSpend restaurant ASCII C (2026-10-10)

## Gap

Domain `buildSupplierSpendTrend` used Unicode `restaurantId.trim()` before
tenant-scoping orders, recommendations, and inventory unit costs. NBSP or
em-space padding around a valid demo workspace token would invent an exact
match against unpadded `restaurant_id` rows and aggregate spend that should
have stayed out of scope.

## Fix

- Added `services/domain/supplierSpendRestaurantIdentity.ts` with ASCII-only
  end trim and fail-closed canonicalize/require helpers.
- Routed `buildSupplierSpendTrend` through
  `requireCanonicalSupplierSpendWorkspaceId`.
- Distinct require message: `Supplier spend requires a restaurant.`
- Non-UUID demo tokens intentionally preserved; max length 128.

## Left alone

- Sales-trends domain restaurant (#775)
- Waste application restaurant (#751)
- Domain `wasteAnalysis` / `inventoryCountAuthority` restaurant Unicode trims
- Orders application restaurant paths

## Verification

- `tests/supplierSpendRestaurantAsciiC.test.ts` + `tests/supplierSpend.test.ts`: 6/6
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)
