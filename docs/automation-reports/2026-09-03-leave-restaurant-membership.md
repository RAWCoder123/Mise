# Leave restaurant membership (2026-09-03)

## Summary
Non-owner operators (admin, manager, staff) can leave a restaurant workspace from
Settings without deleting their Mise account. Owners remain blocked so a
restaurant cannot be orphaned by self-removal.

## Changes
- Additive RPC `leave_my_restaurant_membership` (auth.uid, active membership,
  non-owner only, membership delete + `membership_left` audit)
- Repository / application wiring and demo fail-closed
- Domain helper `canLeaveRestaurantMembership`
- Settings Account leave confirm UI (hidden for owners and local demo)
- Session `refreshWorkspaceAccess` after leave
- EN / ES / zh-Hans catalog keys
- Tests for domain rules, migration grants, settings wiring, security remediation

## Verification
- `npm run typecheck`
- focused leave + team membership + security remediation tests
- `npm test`
- `npm run security:backend`
- `npm run security:static`

## Out of scope
- Owner ownership transfer
- Demo multi-member leave
- Hosted pgTAP / Docker proof of the additive migration
- Live invite reclaim after leave
