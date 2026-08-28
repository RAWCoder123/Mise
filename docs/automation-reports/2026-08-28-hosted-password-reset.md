# Hosted password reset (2026-08-28)

## Summary

Email/password login on `origin/main` had no recovery path. Pilots and App
Store reviewers who lose credentials were stuck after invite acceptance.

This slice adds hosted password reset without inventing inventory facts or
touching open stacks (#130–#224).

## Implemented

- Domain: `services/domain/authRecovery.ts` (email/password validation, scoped
  recovery callback parsing).
- Presentation: login/reset notice helpers.
- Session: `requestPasswordReset`, `completePasswordReset`, recovery-pending
  persistence, `PASSWORD_RECOVERY` auth event, recovery deep-link exchange,
  fail-closed invalid-link StatusNotice.
- UI: Login forgot-password action + `/reset-password` completion screen.
- Routing: index redirects while recovery is pending; route smoke includes
  `/reset-password`.
- Local Auth: `mise://reset-password` (and Expo Go) in
  `supabase/config.toml` additional redirect URLs.
- i18n: EN / ES / zh-Hans.

## Security notes

- Reset request copy does not claim the email exists.
- Recovery is marked only for `type=recovery` or `/reset-password` session
  material — signup/invite PKCE codes are not forced into reset UX.
- Password rules: 8–72 characters, no spaces.
- OAuth `auth/callback` consumer remains separate from recovery exchange.

## Verification

- `npm run typecheck`
- `npm test` (644 passed, 0 failed, 7 cancelled)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## External / founder follow-up

- Hosted Supabase Auth redirect allowlist must include the Expo Linking
  recovery URL (`mise://reset-password` and production deep-link equivalents).

## Readiness

Classification remains **controlled pilot-ready code**. Password recovery is
now implementable for hosted tenants once the Auth redirect allowlist is
updated. Not App Store submission-ready (legal URLs, Apple/EAS, live POS/Gmail,
hosted security re-proof still external).
