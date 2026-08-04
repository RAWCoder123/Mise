# Account deletion client fail-closed (2026-08-04)

## Gap

After Edge `request-account-deletion` hard-deletes the Auth user, the Settings delete flow still depended on a normal `signOut()` path and accepted any truthy deletion `status`. Secondary invoke/sign-out failures could surface as “delete failed” and leave stale restaurant/operator session state even though the account was already removed.

## Fix

1. Domain helper `isCompletedAccountDeletionStatus` requires exact `"completed"`.
2. Hosted repository prefers completed payload status over secondary `functions.invoke` errors; rejects non-completed statuses.
3. Session exposes `clearLocalSessionAfterAccountDeletion`: best-effort remote revoke, always `clearSessionState()`.
4. Settings delete confirmation only navigates away after `status === "completed"` and local session clear; it no longer calls ordinary `signOut()` for this path.

## Verification

- `npm run typecheck`
- `npm test` (account deletion + security contract pins)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

## Remaining

- Docker/hosted private-beta security re-proof still required before pilot promotion.
- Founder privacy/support HTTPS URLs, Apple/EAS/device QA, live POS/Gmail remain external.
