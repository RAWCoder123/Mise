# MISE-005TX More / Settings profile initials ASCII C (2026-10-29)

## Summary

Pin More and Settings `initialsFor(user?.name || user?.email || "Mise")` to
ASCII C end trim + soft-null canonicalize before avatar initials are derived.

## Inventing proof

Prior helpers Unicode-trimmed the signed-in display name (or email fallback)
before splitting on whitespace and taking the first one or two letter tokens:

```text
'\u2003Alex Rivera\u2003'.trim().split(/\s+/).filter(Boolean)
  → ['Alex', 'Rivera'] → 'AR'
```

NBSP / em-space padding therefore invented clean avatar initials rendered into
More and Settings profile chrome. Soft Unicode-only space also collapsed
through `.trim()` into the intentional `"M"` empty-avatar fallback.

## Change

- `services/domain/presentationProfileInitialsIdentity.ts` — ASCII end trim
  only; soft-null on Unicode padding / controls / non-string; derive initials
  from the canonical seed; keep `"M"` when soft-null.
- `app/(tabs)/more.tsx` and `app/(tabs)/settings.tsx` route avatar initials
  through `presentationProfileInitialsFromSeed` and remove local
  `initialsFor`.
- Tests: `tests/presentationProfileInitialsAsciiC.test.ts` (3).

## Explicit non-ownership

Does **not** own:

- Home / Ask Mise greeting firstName (#961 / MISE-005TW)
- outreach draft greeting firstName (#960 / MISE-005TV)
- user profile display-name persistence (#849 / MISE-005PO)
- Create Task assignee chip labels
- More / Settings profile **name** label `.trim()` display
- team member directory labels
- `utils/restaurantBranding` restaurant initials
- `utils/screenTitles` restaurant-name trim

## Verification

- focused `tests/presentationProfileInitialsAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
