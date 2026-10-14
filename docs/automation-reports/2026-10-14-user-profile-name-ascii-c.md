# MISE-005PO user profile display-name ASCII C (2026-10-14)

## Summary

Stop Unicode `.trim()` on operator profile display name from inventing a clean
durable name via em-space / NBSP padding
(`'\u2003Alex Rivera\u2003'.trim() === 'Alex Rivera'`).

## Inventing proof

Application `updateMyProfile` Unicode-trimmed and used the trimmed result
before hosted `update_my_profile` / demo mutate. ASCII C prep (ASCII end trim
only; fail closed when Unicode trim would still strip end padding) leaves
em-space / NBSP alone and does not invent equality with the unpadded name.

## Change

- Add `PROFILE_NAME_MAX_CHARACTERS = 120` to `services/domain/securityLimits.ts`
- Add `services/domain/userProfileNameIdentity.ts`
- Route `services/application/restaurant.ts` `updateMyProfile` through
  `normalizeCanonicalUserProfileName`
- Leave open users.name SQL cntrl pin #654 / MISE-005IL alone (its
  `requireProfileName` still Unicode-trims)
- Leave `/more` presentation `user?.name?.trim()`, restaurant-name tip #844,
  and `normalizeAppUser` hydrate alone

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout hang cancellations)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK with #654. When landing together, route #654 `requireProfileName`
through ASCII C prep and drop mutual Unicode-trim cross-assertions. Keep
`userProfileNameIdentity.ts` separate from `restaurantNameIdentity.ts`.
