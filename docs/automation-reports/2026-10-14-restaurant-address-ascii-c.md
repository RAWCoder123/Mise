# MISE-005PP restaurant address ASCII C (2026-10-14)

## Summary

Stop Unicode `.trim()` on restaurant profile `address` from inventing a clean
durable address via em-space / NBSP padding
(`'\u2003123 Main St\u2003'.trim() === '123 Main St'`).

- Add `services/domain/restaurantAddressIdentity.ts` (ASCII end trim only;
  fail closed when Unicode trim would still strip end padding)
- Route profile patches through exported `requireRestaurantAddress` →
  `normalizeCanonicalRestaurantAddress`
- Leave restaurant name (#844), cuisine (#842), operational profile notes via
  `requireNullableBoundedText`, and hydrate `asNullableString(address)` alone

## Inventing proof

`requireRestaurantProfilePatch` previously routed `address` through
`requireNullableBoundedText`, which Unicode-trimmed and stored the result.
Em-space / NBSP padding invented a clean address before the hosted
`update_restaurant_profile` RPC saw it.

ASCII C single-line address prep (ASCII end trim only; fail closed when
Unicode trim would still strip end padding) leaves em-space alone and does not
invent equality with the unpadded address. Soft empty / Unicode-only spaces
stay soft-null as before.

## Alone-OK merge notes

Alone-OK with open SQL cntrl pin #549 / MISE-005EK. When landing together,
route #549 `requireRestaurantAddress` through ASCII C prep and drop mutual
Unicode-trim cross-assertions; keep `restaurantAddressIdentity.ts` separate
from `restaurantNameIdentity.ts` / `restaurantCuisineTypeIdentity.ts`.
Preserve #549's cntrl CHECK migration and hosted message wording where that tip
is the authority for control-character rejection copy.

## Verification

- focused `tests/restaurantAddressAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
