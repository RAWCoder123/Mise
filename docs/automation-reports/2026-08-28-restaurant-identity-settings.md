# Restaurant identity settings (2026-08-28)

## Gap
Closed PR #75 never merged. Settings showed timezone/currency/service style as read-only rows with no post-onboarding editor. `updateRestaurantProfile` already existed (RPC + demo).

## Change
- Domain: `buildRestaurantIdentityPatch` / options / draft helpers.
- Session `applyRestaurantProfile` keeps active restaurant + workspace switcher in sync.
- Settings `/settings/restaurant` + Restaurant section entry + Operations service deep-link; EN/ES/zh-Hans.
- Owner/admin edit via `canUpdateRestaurantProfile`; staff read-only.
- Hosted writes stay on authenticated RPC `update_restaurant_profile` (no client table DML).
- Tests: `restaurantIdentity.test.ts`, `restaurantIdentitySecurity.test.ts`.

## Verification
- `npm run typecheck`
- `npm test` (636 pass / 0 fail / 7 cancelled pre-existing timeout flakes)
- `npm run security:backend`
- `npm run security:static`

## Product state
Controlled pilot-ready codebase; this closes a real operator settings gap without inventing facts or expanding autonomy.
