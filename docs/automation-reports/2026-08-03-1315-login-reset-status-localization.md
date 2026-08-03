# Login and reset-password status localization (2026-08-03)

## Branch
`cursor/mise-product-inspection-febc` (FF from `cursor/mise-product-inspection-b26b`)

## Gap
`/login` rendered form, sign-in, demo, and password-reset outcomes as plain `Text`. `/reset-password` already used `StatusNotice` for cloud-required and success states, but still rendered form/update failures as plain red `Text` instead of the shared signup/inventory StatusNotice pattern.

## Change
- Added `services/presentation/authLoginPresentation.ts` with:
  - `presentLoginFormEditable`
  - `resolveLoginSignInFailureReason`
  - `resolveLoginResetRequestFailureReason`
  - `presentLoginNoticeCopy`
- Added `services/presentation/authResetPresentation.ts` with:
  - `presentResetFormEditable`
  - `resolveResetFormFailureReason`
  - `presentResetFailureCopy`
- `/login` and `/reset-password` now use localized `StatusNotice` for operator-facing outcomes, disable fields while busy, clear notices on edit, and keep `captureMiseError` without rendering raw `error.message`.
- Added EN/ES/zh-Hans notice title keys for login and reset failure/success outcomes.
- Tests cover presentation helpers, screen wiring, and catalog locales.

## Verification
- `npm run typecheck`
- `npm test` (467 passed)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof were not available in this environment.

## Product state
Controlled pilot-ready code path for login and password-reset operator messaging. Remaining release blockers are ops/credentials (Docker/hosted proof, Auth redirects, Apple/EAS, live POS/Gmail). Next UX candidate: restaurant/profile form StatusNotice consistency.
