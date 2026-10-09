# MISE-005LO pilot-readiness restaurant workspace ASCII C

**Date:** 2026-10-09  
**Branch:** `cursor/mise-product-inspection-a5e4`  
**Base:** `origin/main` @ `78da737`

## Change

Pinned application-layer `pilotReadiness.ts` restaurant workspace identity
(`fetchPilotReadiness`) to ASCII-only end trim via
`services/domain/pilotReadinessRestaurantIdentity.ts`.

Unicode `String.trim()` could invent a workspace identity from NBSP/em-space
padding before pilot-readiness scoped reads. The new helpers fail closed with
the existing `Missing restaurant workspace.` contract and preserve demo
non-UUID tokens such as `restaurant_a`.

## Left alone

- Open sibling restaurant tips #744–#728 (inventory, restaurant-app, setup,
  autonomy, Insights, restaurantTasks, Mise-actions, Today, operatingPlan,
  scheduledRecalculation, recalculation-run transport, recalculation-schedule,
  restaurant-memory, floor-note, activity-event, purchase-line).
- Domain `buildPilotReadiness` restaurantId trim (different error contract:
  `Pilot readiness requires a restaurant id.`; application entry is the
  inventing path for screen-facing reads).

## Verification

- Focused: `tests/pilotReadinessRestaurantAsciiC.test.ts` — 4/4 pass
- `npm run typecheck` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout parent-cancel noise)
- `npm run security:static` — pass
- `npm run security:backend` — pass
- Docker pgTAP unavailable in this environment
