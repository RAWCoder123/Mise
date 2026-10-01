# Team member invite claim (2026-08-28)

## Completed
- Added service-only `restaurant_member_invites` with hashed one-time claim tokens.
- RPCs: create / list / revoke / claim (SECURITY DEFINER, membership advisory lock, audit logs).
- Settings → Team: create/copy invite link, add existing account, revoke pending invites.
- `/invite/[token]` claim screen with pending-token resume via login/index.
- Demo schema v14 memberships + memberInvites for local create/claim proof.
- Tests: `tests/teamInvites.test.ts`; pgTAP `supabase/tests/database/restaurant_member_invites.test.sql`.

## Product state
- Controlled pilot-ready code path for shareable team onboarding without Auth email sending.
- Invitees must already be able to sign in (OAuth or existing email/password). Email/password signup remains a follow-up.
- Hosted migration must be applied before production use.

## Next
- Invite-gated Auth signup for first-time invitees without existing accounts.
- Land/rebase open PR stacks onto main.
- Founder: Auth redirect allowlist for `mise://invite/*` if required.

## Blockers
- Hosted Docker/pgTAP re-proof after migration deploy.
- Live Auth email delivery remains a founder/provider decision (this slice uses shareable links).
