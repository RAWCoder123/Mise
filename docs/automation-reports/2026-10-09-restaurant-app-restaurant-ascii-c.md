# MISE-005LM restaurant app restaurant workspace ASCII C

**Date:** 2026-10-09  
**Branch:** `cursor/mise-restaurant-app-restaurant-ascii-c`  
**Base:** `origin/main` @ `78da737`

## Change

Pinned application-layer `restaurant.ts` restaurant workspace identity
(`fetchRestaurantTeam`, `addRestaurantMemberByEmail`, `deleteAccount`,
`exportRestaurantData`) to ASCII-only end trim via
`services/domain/restaurantAppRestaurantIdentity.ts`.

Unicode `String.trim()` could invent a workspace identity from NBSP/em-space
padding before team, account-deletion, and export scoped reads/writes. The
new helpers fail closed with the existing `Missing restaurant workspace.`
contract and preserve demo non-UUID tokens such as `restaurant_a`.

## Left alone

- Open sibling restaurant tips #742–#728 (setup, autonomy, Insights,
  restaurantTasks, Mise-actions, Today, operatingPlan, scheduledRecalculation,
  recalculation-run transport, recalculation-schedule, restaurant-memory,
  floor-note, activity-event, purchase-line).
- Paths in `restaurant.ts` that did not already use `restaurantId.trim()`
  (`fetchRestaurant`, membership mutations by user id, profile updates,
  POS/AI reads, supplier helpers via `requireSupplierAuthorityId`).
- Email normalization on `addRestaurantMemberByEmail` (covered by team email
  tips).

## Verification

- Focused: `tests/restaurantAppRestaurantAsciiC.test.ts` — 4/4 pass
- `npm run typecheck` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout parent-cancel noise)
- `npm run security:static` — pass
- `npm run security:backend` — pass
- Docker pgTAP unavailable in this environment
