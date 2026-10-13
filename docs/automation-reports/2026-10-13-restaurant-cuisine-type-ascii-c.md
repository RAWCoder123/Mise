# MISE-005PH restaurant cuisine_type ASCII C identity prep (2026-10-13)

## Inventing proof

`requireRestaurantCuisineType` Unicode-trimmed cuisine with soft-empty → null
(`value.trim()` then `normalized || null`). Demo create and session demo-profile
paths also Unicode-trimmed (`cuisineType?.trim() || restaurant.cuisine_type`
and `profile.cuisine_type?.trim() || nextRestaurant.cuisine_type`). Em-space /
NBSP padding invented a clean durable cuisine
(`'\u2003Italian\u2003'.trim() === 'Italian'`).

ASCII C identity prep (ASCII end trim only; fail closed when Unicode trim would
still strip end padding) leaves em-space / NBSP alone and does not invent
equality with the unpadded cuisine. Soft empty / Unicode-only spaces stay
soft-null so create/profile can keep a prior null/empty cuisine without
inventing text from padding. Unicode-padded non-empty tokens fail closed on
the live require path; soft canonicalize on demo/session falls through to the
prior cuisine instead of inventing a clean value.

## Change

- `services/domain/restaurantCuisineTypeIdentity.ts`
- Route `requireRestaurantCuisineType` via `normalizeCanonicalRestaurantCuisineType`
- Route demo `createRestaurantWithOwner` via `canonicalizeRestaurantCuisineType`
- Route session demo-profile cuisine via `canonicalizeRestaurantCuisineType`
- Left `requireRestaurantName`, session `profile.name?.trim()`, setupDrafts /
  setup UI emptiness checks, and miseDomain cuisine readiness emptiness
  presentation alone

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout hang cancellations)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK. Keep module separate from open SQL cuisine cntrl pins #549 / #656 and
from restaurant-name inventing. When landing with sibling tips, drop mutual
Unicode-trim cross-assertions.
