# Restaurant member invite claim (2026-07-31)

## Completed

- Fast-forwarded `cursor/mise-product-inspection-70cd` from tip `cursor/mise-product-inspection-79c6`.
- Added RPC-only `restaurant_member_invites` with hashed one-time claim tokens.
- Owners/admins can create/list/revoke shareable invites without Auth email delivery.
- Invitees sign in with the invited email and claim via `/invite/[token]`.
- Settings → Team creates invite links, copies claim paths, and lists pending invites.
- Demo mode supports create/revoke/claim with the same email-match rules.
- Login resumes a pending invite path after sign-in.

## Verification

- Unit/domain coverage in `tests/teamInvites.test.ts` (token hashing, authority, demo create/revoke/claim).
- pgTAP suite `supabase/tests/database/restaurant_member_invites.test.sql` (requires Docker).
- Route smoke includes `/invite/...`.
- `restaurant_member_invites` marked service-only in security static/backend checks.

## Remaining

- Docker + hosted `verify:private-beta-security` re-proof after this migration.
- True Auth email invite delivery still requires founder product decision and provider config.
- Founder privacy/support HTTPS URLs, Apple/TestFlight, live POS/Gmail remain external blockers.
