# MISE-005LX: pin orders restaurant workspace to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-orders-restaurant-ascii-c`

## Problem

Application `orders.ts` normalized `restaurantId` with Unicode `String.trim()`
in `fetchPurchaseRecommendationAuthorities` before loading purchase recommendation
authorities. NBSP or em-space padding around a demo or hosted workspace token
would invent a different identity than ASCII-only end trim, while still matching
the unpadded tenant under Unicode trim.

## Change

- Added `services/domain/ordersRestaurantIdentity.ts` with ASCII-only end trim,
  length/control fail-closed checks, and
  `requireCanonicalOrdersWorkspaceId`.
- Routed `fetchPurchaseRecommendationAuthorities` through that helper while
  preserving `Missing restaurant workspace.`
- Preserved non-UUID demo workspace tokens (`restaurant_a`).
- Left local `requireWorkflowId(..., "restaurant")` (`Missing restaurant.`) and
  Gmail/send workflow paths untouched (`tests/gmailClient.test.ts` contract).
- Left activity (#753), findings (#752), waste (#751), dailyReport (#750),
  findingDecisions (#749), deliveries (#748), and other sibling restaurant tips
  untouched.

## Verification

- Focused: `tests/ordersRestaurantAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
