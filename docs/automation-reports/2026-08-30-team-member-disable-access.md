# Team member disable / restore access (2026-08-30)

## Problem

`update_restaurant_member(..., p_status)` already accepts `active | disabled`, and
RLS / membership checks treat non-active rows as cut off. Team Settings only
exposed role change and hard remove. Operators could not suspend access
reversibly without deleting the membership row.

## Change

- Domain: `nextTeamMemberAccessStatus`, `isTeamMemberAccessDisabled`;
  `canEditTeamMember` rejects invitation rows (client RPCs already fail closed).
- UI: status badge + Disable access / Restore access on Team Settings, confirm
  before disable, calls existing `updateRestaurantMember(..., { status })`.
- i18n: EN / ES / zh-Hans keys for status, actions, confirm, and notices.

## Verification

- `npm run typecheck`
- `npm test -- tests/teamMembership.test.ts`
- Broader `npm test` as available in the cloud agent

## Not in scope

- Invite claim / invitee Auth bootstrap (founder policy / open stacks)
- Demo multi-member mutations (demo remains single-operator)
- New migrations (RPC already exists)
