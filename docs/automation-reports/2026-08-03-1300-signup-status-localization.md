# Signup status localization (2026-08-03)

## Branch
`cursor/mise-product-inspection-b26b` (FF from `cursor/mise-product-inspection-5984`)

## Gap
`/signup` already mapped failures to MessageKeys, but rendered them as plain red `Text` instead of the shared `StatusNotice` pattern used by inventory create/count and setup. Create failures also matched backend English strings inline in the screen.

## Change
- Added `services/presentation/authSignupPresentation.ts` with:
  - `presentSignupFormEditable`
  - `resolveSignupFormFailureReason`
  - `resolveSignupCreateFailureReason`
  - `presentSignupFailureCopy`
- `/signup` now uses localized `StatusNotice` for form and create failures, disables fields while creating, clears notices on edit, and reports create failures through `captureMiseError`.
- Added EN/ES/zh-Hans notice title keys for email, password, mismatch, already-exists, and create-failed outcomes.
- Tests cover form/create failure mapping, screen wiring, and catalog locales.

## Verification
- `npm run typecheck`
- `npm test` (458 passed)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof were not available in this environment.

## Product state
Controlled pilot-ready code path for signup operator messaging. Remaining release blockers are ops/credentials (Docker/hosted proof, Auth redirects, Apple/EAS, live POS/Gmail). Next UX candidate: login/reset-password StatusNotice polish or restaurant/profile form StatusNotice consistency.
