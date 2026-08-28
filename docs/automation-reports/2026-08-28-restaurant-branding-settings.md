# Restaurant branding settings (2026-08-28)

## Completed
- Extended Settings → Restaurant identity (`/settings/restaurant`) so owners/admins can edit
  `brand_color`, `accent_color`, and HTTPS `logo_url` alongside identity fields.
- Sparse patches still go through authenticated `update_restaurant_profile` with
  `requireRestaurantProfilePatch` (hex + HTTPS logo validation).
- Staff remain read-only; session `applyRestaurantProfile` keeps the active restaurant in sync.
- EN / ES / zh-Hans copy updated; unit + security contract tests cover branding markers.

## Stack
- Branched from `cursor/mise-restaurant-identity-settings` (PR #223).
- Reimplements deferred branding from closed #76 without reopening that PR.

## Verification
- `npm run typecheck`
- `npm test` (restaurantIdentity + security contract focus; full suite)
- `npm run security:backend`
- `npm run security:static`

## Remaining
- Soft-refresh polish (closed #87) still deferred.
- Land/rebase open stacks onto main; founder App Store / credential steps remain external.
