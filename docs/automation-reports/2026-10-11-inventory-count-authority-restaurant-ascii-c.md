# MISE-005MV: inventoryCountAuthority restaurant workspace ASCII C

Pinned domain `buildInventoryCountEvidence` `restaurantId` to ASCII-only end trim
so NBSP/em-space padding cannot invent an exact tenant match against unpadded
ledger `restaurantId` values before count evidence assembly.

## Scope

- Helper: `services/domain/inventoryCountAuthorityRestaurantIdentity.ts`
- Wired: `services/domain/inventoryCountAuthority.ts` via
  `requireCanonicalInventoryCountAuthorityWorkspaceId`
- Error contract: `Inventory count evidence requires a restaurant.`
- Left alone: waste-analysis domain (#777 /
  `Waste analysis requires a restaurant.`); open supplier-spend domain (#776);
  sibling domain restaurant Unicode trims on those modules

## Verification

- Focused inventing proofs in `tests/inventoryCountAuthorityRestaurantAsciiC.test.ts`
- Existing `tests/authoritativeInventoryCount.test.ts` remains green
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
