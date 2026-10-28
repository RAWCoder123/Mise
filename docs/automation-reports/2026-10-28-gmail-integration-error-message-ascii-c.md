# MISE-005SR: pin Gmail integration error messages to ASCII C

Date: 2026-10-28

## Inventing proof

Prior `gmailIntegrationErrorFrom` Unicode-trimmed Edge `payload.message` /
`payload.error` before becoming the operator-facing
`GmailIntegrationError` message:

```text
'\u2003Gmail token refresh failed.\u2003'
  .trim()
  === 'Gmail token refresh failed.'
```

That invented a clean diagnostic into the integration error surface.

## Change

- Add `services/repositories/gmailIntegrationErrorMessageIdentity.ts`
- Route Gmail message prep through `resolveGmailIntegrationErrorMessage`
- Fold NBSP, C-end-trim only, leave em-space padding alone
- Soft-null Unicode-only spaces / unsafe controls (LF/TAB/CR allowed)
- Keep max 320 and caller-supplied fallback contract
- Leave Square `squareIntegrationErrorFrom` message prep, account-deletion
  `payload.error` / `deletionReference`, and export-restaurant-data
  `payload.error` alone

## Verification

- Focused: `tests/gmailIntegrationErrorMessageAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

## Merge note

Alone-OK with #929 / #928 / #927 and remaining repository error-haystack
siblings. Keep `gmailIntegrationErrorMessageIdentity.ts` separate from Square
integration error-message, recalculation describeError, and schedule
failure-reason helpers. When landing with #929, resolve the Square tip's
assertion that Gmail still uses Unicode `.trim().slice(0, 320)` textually.
