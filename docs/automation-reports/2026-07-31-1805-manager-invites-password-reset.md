# Manager invite visibility and password reset (2026-07-31)

## Completed

- Fast-forwarded `cursor/mise-product-inspection-af3f` from tip `cursor/mise-product-inspection-82f9`.
- Managers can review pending team invites as read-only on Settings → Team (list RPC already allowed manager; UI no longer gated on manage-only).
- Added hosted password reset: Login forgot-password request, PKCE auth callback handling, `/reset-password` completion screen, and recovery redirect guards.

## Verification

- Unit/domain coverage in `tests/teamInvites.test.ts`, `tests/teamMembership.test.ts`, `tests/authRecovery.test.ts`.
- Typecheck + full `npm test` + security/design static gates in this run.
- Route smoke includes `/reset-password`.

## Remaining / external

- Supabase Auth redirect URL allowlist must include the app recovery redirect (`mise://reset-password` / Expo Linking URL).
- Docker + hosted `verify:private-beta-security` re-proof still blocked without Docker/staging credentials.
- Founder privacy/support HTTPS URLs, Apple/TestFlight, live POS/Gmail remain external blockers.
