# MISE-005LN inventory restaurant workspace ASCII C

**Date:** 2026-10-09  
**Branch:** `cursor/mise-inventory-restaurant-ascii-c`  
**Base:** `origin/main` @ `78da737`

## Change

Pinned application-layer `inventory.ts` restaurant workspace identity
(`confirmRecipeBaselineComplete`) to ASCII-only end trim via
`services/domain/inventoryRestaurantIdentity.ts`.

Unicode `String.trim()` could invent a workspace identity from NBSP/em-space
padding before recipe-baseline confirmation scoped writes. The new helpers
fail closed with the existing `Missing restaurant workspace.` contract and
preserve demo non-UUID tokens such as `restaurant_a`.

## Left alone

- Open sibling restaurant tips #743–#728 (restaurant-app, setup, autonomy,
  Insights, restaurantTasks, Mise-actions, Today, operatingPlan,
  scheduledRecalculation, recalculation-run transport, recalculation-schedule,
  restaurant-memory, floor-note, activity-event, purchase-line).
- Paths in `inventory.ts` that did not already use `restaurantId.trim()`
  (planning reads, outlooks, count sessions, item patches, paths already using
  `requireSupplierAuthorityId`).
- Menu-item id trim on `confirmRecipeBaselineComplete` (not a restaurant
  workspace identity).

## Verification

- Focused: `tests/inventoryRestaurantAsciiC.test.ts` — 4/4 pass
- `npm run typecheck` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout parent-cancel noise)
- `npm run security:static` — pass
- `npm run security:backend` — pass
- Docker pgTAP unavailable in this environment
