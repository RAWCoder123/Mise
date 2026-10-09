# MISE-005LL: pin setup restaurant workspace to ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-setup-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Gap

Unicode `restaurantId.trim()` on the setup application `saveRestaurantSetup`
entry point could invent a restaurant workspace identity from NBSP/em-space
padding before supplier/inventory/recipe persistence and restaurant-scoped
writes.

## Change

- Added `services/domain/setupRestaurantIdentity.ts` with ASCII-only end trim
  and fail-closed canonicalize/require helpers.
- Routed `saveRestaurantSetup` through `requireCanonicalSetupWorkspaceId`
  (preserves `Missing restaurant workspace.`).
- Preserved non-UUID demo workspace tokens (`restaurant_a`).
- Left sibling restaurant tips and setup field trims (supplier name/email,
  inventory names, recipe dish names, attachment labels) alone.

## Verification

- `tests/setupRestaurantAsciiC.test.ts` 4/4
- `npm run typecheck` passed
- `npm test` 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `withTimeout` parent-cancel noise; tip proofs included and green)
- `npm run security:static` / `npm run security:backend` passed

## Classification

Controlled pilot-ready tip. Not App Store submission-ready.
