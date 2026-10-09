# MISE-005LU: pin waste restaurant workspace to ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-waste-restaurant-ascii-c`

## Problem

Application `waste.ts` normalized `restaurantId` with Unicode `String.trim()`
before waste analysis assembly. NBSP or em-space padding around a demo or
hosted workspace token would invent a different identity than ASCII-only end
trim, while still matching the unpadded tenant under Unicode trim.

## Change

- Added `services/domain/wasteRestaurantIdentity.ts` with ASCII-only end trim,
  length/control fail-closed checks, and
  `requireCanonicalWasteWorkspaceId`.
- Routed `fetchWasteAnalysis` through that helper while preserving
  `Missing restaurant workspace.`
- Preserved non-UUID demo workspace tokens (`restaurant_a`).
- Left dailyReport (#750), findingDecisions (#749), deliveries (#748), orders,
  findings, activity, and other sibling restaurant tips untouched.

## Verification

- Focused: `tests/wasteRestaurantAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
