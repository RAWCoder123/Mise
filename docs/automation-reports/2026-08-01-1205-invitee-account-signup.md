# Invitee account signup (2026-08-01)

## Problem
Team invite claim required an existing Supabase Auth session, but Mise had no `signUp` path. Newly invited teammates (and first-time owners on hosted setup) could not create an account from the app.

## Change
- Added `services/domain/authSignup.ts` for email/password validation, duplicate-identity detection, and post-auth routing (pending invite wins).
- Added `signUp` to `MiseSessionContext` via `supabase.auth.signUp`, with invite-aware `emailRedirectTo`.
- Added `/signup` screen and Create account CTAs from Login + Invite claim.
- Invite claim auto-starts once a signed-in user lands on a valid token.
- Login no longer races authenticated users to `/setup` when a pending invite token is stored.

## Verification
- `npm run typecheck`
- `npm test` (includes `tests/authSignup.test.ts`)
- `npm run security:backend`, `security:static`, `design:static` as available
