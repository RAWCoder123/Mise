# Restaurant and profile identity form StatusNotice localization (2026-08-03)

## Branch
`cursor/mise-product-inspection-da24` (FF from `cursor/mise-product-inspection-febc`)

## Gap
`/settings/profile` and `/settings/restaurant` rendered validation and save outcomes as plain red `Text` / custom status boxes instead of the shared auth and inventory `StatusNotice` pattern. Restaurant save failures also matched backend English `error.message` strings inline in the screen.

## Change
- Added `services/presentation/restaurantIdentityFormPresentation.ts` with:
  - `presentRestaurantIdentityFormEditable`
  - `resolveRestaurantIdentitySaveFailureReason`
  - `presentRestaurantIdentityNoticeCopy`
- Added `services/presentation/profileIdentityFormPresentation.ts` with:
  - `presentProfileIdentityFormEditable`
  - `resolveProfileIdentitySaveFailureReason`
  - `presentProfileIdentityNoticeCopy`
- `/settings/profile` and `/settings/restaurant` now use localized `StatusNotice` for validation, save failure, and success outcomes; fields stay disabled while busy; notices clear on edit; `captureMiseError` remains without rendering raw `error.message`.
- Added EN/ES/zh-Hans notice title keys for profile and restaurant identity outcomes.
- Tests cover presentation helpers, screen wiring, and catalog locales.

## Verification
- `npm run typecheck`
- `npm test` (475 passed)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof were not available in this environment.

## Product state
Controlled pilot-ready code path for profile and restaurant identity operator messaging. Remaining release blockers are ops/credentials (Docker/hosted proof, Auth redirects, Apple/EAS, live POS/Gmail).
