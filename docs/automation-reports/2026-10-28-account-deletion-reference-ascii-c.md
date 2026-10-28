# MISE-005ST: pin account-deletion deletionReference to ASCII C

Date: 2026-10-28

## Inventing proof

Prior `deleteAccount` Unicode-trimmed Edge `payload.deletionReference`
before appending it into the operator-facing `Error` message as
`Reference: …`:

```text
'\u2003a1b2c3d4-e5f6-4789-a012-3456789abcde\u2003'
  .trim()
  === 'a1b2c3d4-e5f6-4789-a012-3456789abcde'
```

That invented a clean support reference into the account-deletion error
surface. Soft empty / Unicode-only space also invented the no-Reference
branch via `'\u2003'.trim() === ''`.

## Change

- Add `services/repositories/accountDeletionReferenceIdentity.ts`
- Route account-deletion `payload.deletionReference` prep through
  `resolveAccountDeletionReference`
- ASCII-only end trim; fail closed on remaining Unicode padding (NBSP /
  em-space) and control characters
- Soft empty / inventing padding → `""` so the prior falsy check omits
  `Reference:`
- Keep max 80 truncate contract for clean ASCII-C references
- Leave account-deletion `payload.error` (open #931 / MISE-005SS),
  export-restaurant-data `payload.error`, Gmail
  `gmailIntegrationErrorFrom`, and Square `squareIntegrationErrorFrom`
  alone

## Verification

- Focused: `tests/accountDeletionReferenceAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

## Merge note

Alone-OK with #931 / #930 / #929 / #928 / #927 and remaining repository
error-haystack siblings. Keep `accountDeletionReferenceIdentity.ts`
separate from `accountDeletionErrorMessageIdentity.ts` (#931) and from
Gmail / Square integration error-message helpers. When landing with
#931, resolve `deleteAccount` textually: #931 owns `payload.error`, this
tip owns `payload.deletionReference`. Do not tip export-restaurant-data
`payload.error` through this module — tip that separately.
