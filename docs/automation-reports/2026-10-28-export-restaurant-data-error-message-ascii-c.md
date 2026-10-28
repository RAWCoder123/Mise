# MISE-005SU: pin export-restaurant-data error messages to ASCII C

Date: 2026-10-28

## Inventing proof

Prior `exportRestaurantData` Unicode-trimmed Edge `payload.error` before
becoming the operator-facing `Error` message:

```text
'\u2003Your restaurant export is unchanged — try again.\u2003'
  .trim()
  === 'Your restaurant export is unchanged — try again.'
```

That invented a clean diagnostic into the export-restaurant-data error
surface.

## Change

- Add `services/repositories/exportRestaurantDataErrorMessageIdentity.ts`
- Route export-restaurant-data `payload.error` prep through
  `resolveExportRestaurantDataErrorMessage`
- Fold NBSP, C-end-trim only, leave em-space padding alone
- Soft-null Unicode-only spaces / unsafe controls (LF/TAB/CR allowed)
- Keep max 320 and caller-supplied fallback contract
- Leave account-deletion `payload.error` / `deletionReference`, Gmail
  `gmailIntegrationErrorFrom`, and Square `squareIntegrationErrorFrom`
  alone

## Verification

- Focused: `tests/exportRestaurantDataErrorMessageAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

## Merge note

Alone-OK with #932 / #931 / #930 / #929 / #928 / #927 and remaining
repository error-haystack siblings. Keep
`exportRestaurantDataErrorMessageIdentity.ts` separate from
account-deletion error-message / deletionReference, Gmail / Square
integration error-message, recalculation describeError, and schedule
failure-reason helpers. When landing with #931/#932, resolve
`supabaseRepository.ts` textually (#931 owns deleteAccount
`payload.error`; #932 owns `deletionReference`; this tip owns export
`payload.error`). Do not tip account-deletion or integration haystacks
through this module — tip those separately.
