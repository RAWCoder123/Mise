# MISE-005LZ: pin orders requireWorkflowId restaurant to ASCII C

Date: 2026-10-10  
Base: `origin/main` @ `78da737`

## Problem

Application `orders.ts` local `requireWorkflowId(..., "restaurant")` normalized
restaurant workspace tokens with Unicode `String.trim()`. NBSP or em-space
padding around a demo or hosted workspace token would invent a different
identity than ASCII-only end trim, while still matching the unpadded tenant
under Unicode trim. Open tip #754 covers only
`fetchPurchaseRecommendationAuthorities` (`Missing restaurant workspace.`) and
explicitly leaves this `Missing restaurant.` workflow path alone.

## Change

- Added `services/domain/ordersWorkflowRestaurantIdentity.ts` with ASCII-only
  end trim, length/control fail-closed checks, and
  `requireCanonicalOrdersWorkflowRestaurantId`.
- Routed `requireWorkflowId` restaurant label through that helper while
  preserving `Missing restaurant.` and
  `requireWorkflowId(restaurantId, "restaurant")` call sites
  (`tests/gmailClient.test.ts` contract).
- Left non-restaurant `requireWorkflowId` labels on Unicode trim.
- Left `fetchPurchaseRecommendationAuthorities` Unicode trim for #754.
- Preserved non-UUID demo workspace tokens (`restaurant_a`).

## Merge note

When landing with #754 (`ordersRestaurantIdentity` / authorities path), drop
#754’s static assertion that `requireWorkflowId` still uses Unicode
`value.trim()` for the restaurant label. This tip owns that restaurant workflow
path; #754 owns the authorities `Missing restaurant workspace.` path.

## Verification

- Focused: `tests/ordersWorkflowRestaurantAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
