# MISE-005IM: users.email locale pin

Date: 2026-10-05

## Change

Attach `users_email_check` as length 3–254, trimmed, ASCII C `[[:cntrl:]]`
rejection, and `[[:space:]]` mailbox shape under `COLLATE "C"`. Does not
require `lower()` — Auth may preserve mailbox casing; team invite lookup
already lowercases for compare.

CHECK-only; alone-OK vs users.name (#654), preferred_locale (#463), and team
candidate email normalize (#435). Does not rewrite `update_my_profile`.

## Why

Foundation left `public.users.email` as NOT NULL UNIQUE text with no length,
trim, cntrl, or mailbox-shape gate. Profile writers copy `auth.users.email` on
first insert, but dump/restore had no table-level mailbox gate under COLLATE C.

## Verification

- `npm run typecheck`
- focused `usersEmailLocalePin`
- `npm test`
- pgTAP fixture committed; plan derived from assertion call sites
