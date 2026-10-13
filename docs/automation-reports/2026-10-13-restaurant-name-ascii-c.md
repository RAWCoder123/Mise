# MISE-005PJ restaurant name ASCII C identity prep (2026-10-13)

## Inventing proof

`requireRestaurantName` Unicode-trimmed restaurant names
(`value.trim()` then length-bound). Demo create and session demo-profile
paths also Unicode-trimmed (`name.trim() || restaurant.name` and
`profile.name?.trim() || nextRestaurant.name`). Em-space / NBSP padding
invented a clean durable restaurant name
(`'\u2003Bistro Nova\u2003'.trim() === 'Bistro Nova'`).

ASCII C identity prep (ASCII end trim only; fail closed when Unicode trim would
still strip end padding) leaves em-space / NBSP alone and does not invent
equality with the unpadded name. Soft empty / Unicode-only spaces stay
soft-null on soft canonicalize so demo/session can keep a prior name without
inventing text from padding. Soft empty on the live require path preserves the
prior length-bound error. Unicode-padded non-empty tokens fail closed on the
live require path; soft canonicalize on demo/session falls through to the prior
name instead of inventing a clean value.

## Change

- `services/domain/restaurantNameIdentity.ts`
- Route `requireRestaurantName` via `normalizeCanonicalRestaurantName`
- Route demo `createRestaurantWithOwner` via `canonicalizeRestaurantName`
- Route session demo-profile name via `canonicalizeRestaurantName`
- Left `requireRestaurantCuisineType`, session cuisine trim, setupDrafts /
  setup UI emptiness checks, and `updateMyProfile` user display-name trim alone

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout hang cancellations)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK. Keep module separate from open SQL name cntrl pin #548 / MISE-005EJ
and demoDataset restaurant-name match tip #685 / MISE-005JP. When landing with
#842 cuisine tip, drop mutual Unicode-trim cross-assertions
(`requireRestaurantName` still `.trim()` / `requireRestaurantCuisineType` still
`.trim()` / session name vs cuisine trim assertions).
