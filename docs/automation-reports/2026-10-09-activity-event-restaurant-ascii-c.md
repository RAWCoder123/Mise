# MISE-005KZ activity-event restaurant workspace ASCII C

Date: 2026-10-09  
Base: `origin/main` @ `78da737`

## Problem

Unicode `String.prototype.trim()` on activity-event `restaurantId` / `restaurant_id` strips NBSP and em-space padding. A padded demo or workspace token such as `\u00a0restaurant_a\u00a0` therefore collapses to `restaurant_a` and invents a canonical restaurant workspace identity before activity construction, tenant-scope checks, shortage sequence IDs, or persisted-row hydration.

## Change

- Add `services/domain/activityEventRestaurantIdentity.ts` with ASCII-only end trim, canonicalize, and fail-closed require helpers.
- Route `services/domain/activityEvents.ts` `requireRestaurantId` through `requireCanonicalActivityEventRestaurantId`.
- Preserve the exact `Activity events require a restaurant id.` error contract and non-UUID demo workspace tokens.
- Leave purchase-line (#728), supplier-recipient (#727), floor-notes, and restaurant-memory restaurant tips untouched.

## Verification

- Focused inventing proofs: `tests/activityEventRestaurantAsciiC.test.ts`
- Related: `tests/activityEvents.test.ts`
- `npm run typecheck`
- `npm test` (full suite)
- `npm run security:static`
- `npm run security:backend`

## Merge notes

Alone-OK relative to #728 / #727 (separate helper files and error contracts). Do not re-tip this activity-event restaurant_id path after land.
