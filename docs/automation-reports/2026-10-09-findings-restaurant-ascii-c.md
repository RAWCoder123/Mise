# MISE-005LV: pin findings restaurant workspace to ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-findings-restaurant-ascii-c`

## Problem

Application `findings.ts` normalized `restaurantId` with Unicode `String.trim()`
before daily operational brief assembly. NBSP or em-space padding around a demo
or hosted workspace token would invent a different identity than ASCII-only end
trim, while still matching the unpadded tenant under Unicode trim.

## Change

- Added `services/domain/findingsRestaurantIdentity.ts` with ASCII-only end trim,
  length/control fail-closed checks, and
  `requireCanonicalFindingsWorkspaceId`.
- Routed `fetchDailyOperationalBrief` through that helper while preserving
  `Missing restaurant workspace.`
- Preserved non-UUID demo workspace tokens (`restaurant_a`).
- Left waste (#751), dailyReport (#750), findingDecisions (#749), deliveries
  (#748), orders workspace, activity application, domain `operationalFindings`
  trim, and other sibling restaurant tips untouched.

## Verification

- Focused: `tests/findingsRestaurantAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
