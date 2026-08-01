# Member invite list read-path purity + claim escape

Date: 2026-08-01
Branch: `cursor/mise-product-inspection-4923`
Base tip: `bd8a5c4` (fast-forwarded from `cursor/mise-product-inspection-3408`)

## Completed

1. **`list_restaurant_member_invites` is read-only** — new migration computes effective `expired` status for past-due pending invites without `UPDATE`ing rows (same pattern as storage-location list purity).
2. **Demo list path aligned** — `listDemoMemberInvites` uses `effectiveInviteStatus` and no longer mutates stored demo invite rows.
3. **Invite claim escape hatch** — terminal claim failures (expired / revoked / already claimed) clear the pending invite token and offer Continue without this invite; email mismatch keeps the token but exposes the same dismiss action; invalid tokens clear pending storage.
4. **Domain helpers** — `effectiveInviteStatus`, `classifyInviteClaimFailure`, `isTerminalInviteClaimFailure` with unit coverage.
5. **pgTAP + static security gates** — invite suite plan 18; security/team invite wiring asserts no list-path UPDATE.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker/pgTAP execution and hosted staging re-proof remain environment-blocked in this workspace.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate re-run. Not App Store submission-ready.
