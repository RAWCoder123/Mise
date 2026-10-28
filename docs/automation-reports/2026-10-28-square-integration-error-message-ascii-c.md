# MISE-005SQ: pin Square integration error messages to ASCII C

Date: 2026-10-28

## Inventing proof

Prior `squareIntegrationErrorFrom` Unicode-trimmed Edge `payload.message` /
`payload.error` before becoming the operator-facing
`SquareIntegrationError` message:

```text
'\u2003Square token refresh failed.\u2003'
  .trim()
  === 'Square token refresh failed.'
```

That invented a clean diagnostic into the integration error surface.

## Change

- Add `services/repositories/squareIntegrationErrorMessageIdentity.ts`
- Route Square message prep through `resolveSquareIntegrationErrorMessage`
- Fold NBSP, C-end-trim only, leave em-space padding alone
- Soft-null Unicode-only spaces / unsafe controls (LF/TAB/CR allowed)
- Keep max 320 and caller-supplied fallback contract
- Leave Gmail `gmailIntegrationErrorFrom` message prep, account-deletion
  `payload.error` / `deletionReference`, and export-restaurant-data
  `payload.error` alone

## Verification

- Focused: `tests/squareIntegrationErrorMessageAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

## Merge note

Alone-OK with #928 / #927 and remaining repository error-haystack siblings.
Keep `squareIntegrationErrorMessageIdentity.ts` separate from recalculation
describeError / schedule failure-reason helpers.
