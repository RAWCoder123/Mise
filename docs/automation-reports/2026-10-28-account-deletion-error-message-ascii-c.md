# MISE-005SS: pin account-deletion error messages to ASCII C

Date: 2026-10-28

## Inventing proof

Prior `deleteAccount` Unicode-trimmed Edge `payload.error` before becoming
the operator-facing `Error` message:

```text
'\u2003Your restaurant access is unchanged — try again.\u2003'
  .trim()
  === 'Your restaurant access is unchanged — try again.'
```

That invented a clean diagnostic into the account-deletion error surface.

## Change

- Add `services/repositories/accountDeletionErrorMessageIdentity.ts`
- Route account-deletion `payload.error` prep through
  `resolveAccountDeletionErrorMessage`
- Fold NBSP, C-end-trim only, leave em-space padding alone
- Soft-null Unicode-only spaces / unsafe controls (LF/TAB/CR allowed)
- Keep max 320 and caller-supplied fallback contract
- Leave account-deletion `deletionReference`, export-restaurant-data
  `payload.error`, Gmail `gmailIntegrationErrorFrom`, and Square
  `squareIntegrationErrorFrom` alone

## Verification

- Focused: `tests/accountDeletionErrorMessageAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

## Merge note

Alone-OK with #930 / #929 / #928 / #927 and remaining repository
error-haystack siblings. Keep `accountDeletionErrorMessageIdentity.ts`
separate from Gmail / Square integration error-message, recalculation
describeError, and schedule failure-reason helpers. Do not tip
`deletionReference` or export-restaurant-data `payload.error` through this
module — tip those separately.
