# MISE-005AA team member candidate email locale pin

Date: 2026-09-26  
Base: `origin/main` @ `78da737`  
Branch: `cursor/mise-team-member-candidate-email-locale-pin`

## Gap

`public.find_restaurant_member_candidate` normalized and compared invite lookup
emails with bare `lower()` / `btrim()` and a weak `strpos('@')` gate. Locale
drift under libc `en_US.UTF-8` can diverge Auth mailbox matching after
dump/restore, breaking owner/admin membership invite continuity. Sibling
supplier-send / Gmail email pins (MISE-005N–R) already used `COLLATE "C"`.

## Change

Additive migration rewrites only `find_restaurant_member_candidate` so:

- normalize uses `lower(btrim(...) COLLATE "C") COLLATE "C"`;
- fail-closed shape matches client `normalizeTeamMemberEmail` under `COLLATE "C"`;
- Auth compare uses `lower(auth_user.email COLLATE "C") COLLATE "C"`;
- EXECUTE remains authenticated-only.

Does not rewrite `list_restaurant_members` or membership mutators. Compose-safe
alone on main; timestamp after MISE-005Z. Open invite-token stack (#235) still
needs its own follow-up locale pin after land.

## Verification

- `npm run typecheck`
- focused `tests/teamMemberCandidateEmailLocalePin.test.ts`
- `npm test`
