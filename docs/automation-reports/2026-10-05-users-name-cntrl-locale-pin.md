# MISE-005IL users.name cntrl locale pin

Date: 2026-10-05

## Change

CHECK-only attach of `users_name_check`:

- length `btrim(name)` between 1 and 120 (matches `update_my_profile`)
- reject ASCII controls with `name collate "C" !~ '[[:cntrl:]]'`

Client `requireProfileName` rejects the same ASCII C control set
(`U+0000–U+001F`, `U+007F`) before a round-trip. `updateMyProfile` routes
through that helper.

## Why

Foundation left `public.users.name` as unbound NOT NULL text. The writer
already bounded length, but the table CHECK had no durable length or cntrl
gate under COLLATE C. Operator display name is durable identity for team
directory and activity attribution. Sibling MISE-005 tips pin single-line
text CHECKs under `COLLATE "C"` so dump/restore cannot accept bytes a
restored C-locale path would refuse.

## Out of scope

- `update_my_profile` rewrite
- `users.preferred_locale` (#463)
- membership role/status (#489)
- `users.email` (auth-synced)

## Verification

- `npm run typecheck`
- focused `usersNameCntrlLocalePin` tests
- `npm test`
- pgTAP plan **11** counted from 11 assertion call sites
