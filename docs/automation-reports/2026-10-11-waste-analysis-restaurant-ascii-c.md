# MISE-005MU: wasteAnalysis restaurant workspace ASCII C

Pinned domain `buildWasteAnalysis` `restaurantId` to ASCII-only end trim so
NBSP/em-space padding cannot invent an exact tenant match against unpadded
inventory and waste-event `restaurantId` values before analysis assembly.

## Scope

- Helper: `services/domain/wasteAnalysisRestaurantIdentity.ts`
- Wired: `services/domain/wasteAnalysis.ts` via `requireCanonicalWasteAnalysisWorkspaceId`
- Error contract: `Waste analysis requires a restaurant.`
- Left alone: waste application (#751 / `Missing restaurant workspace.`); open
  supplier-spend domain (#776); sibling domain `inventoryCountAuthority`
  restaurant Unicode trim

## Verification

- Focused inventing proofs in `tests/wasteAnalysisRestaurantAsciiC.test.ts`
- Existing `tests/wasteAnalysis.test.ts` remains green
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
