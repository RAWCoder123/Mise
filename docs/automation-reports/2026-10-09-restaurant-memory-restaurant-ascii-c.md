# MISE-005LB restaurant-memory restaurant workspace ASCII C

Date: 2026-10-09

## Change

Pinned restaurant-memory `restaurantId` / `restaurant_id` outside the Unicode
`.trim()` inventing path. NBSP / em-space padding around a demo or hosted
workspace token no longer collapses to the unpadded identity before memory
creation, persisted-row hydration, fetch, decision updates, or safe-rule
conversion.

## Surfaces

- `services/domain/restaurantMemoryRestaurantIdentity.ts` — ASCII-only end trim,
  canonicalize, domain require (`Restaurant memory requires a restaurant id.`),
  application require (`Missing restaurant workspace.`)
- `services/domain/restaurantMemory.ts` — `requireRestaurantId` +
  `restaurantMemoryFromPersistedRow`
- `services/application/restaurantMemory.ts` — fetch / decision / convert entry
  points

## Preserved

- Demo non-UUID workspace tokens (`restaurant_a`)
- Existing domain and application error contracts
- Statement / scope / source / correction trim elsewhere (out of scope)

## Left alone

- Floor-note (#730), activity-event (#729), purchase-line (#728),
  supplier-recipient (#727) restaurant tips
- Recalculation restaurantId trim paths (next alone-OK tip)

## Proof

- `tests/restaurantMemoryRestaurantAsciiC.test.ts`
