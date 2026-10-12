# MISE-005NS: pin Mise-actions rollbackReference to ASCII C

Date: 2026-10-12

## Inventing proof

Domain `markReversed` previously stored `rollbackReference.trim()`. Unicode trim
strips NBSP / em-space padding and invents a durable reverse reference:

```text
'\u00a0rollback_1\u00a0'.trim() === 'rollback_1'
```

ASCII-C canonicalize returns null for the same padded token, and
`requireCanonicalMiseActionsRollbackReference` throws
`Mise action rollbackReference is invalid.`

## Change

- Added `services/domain/miseActionsRollbackReferenceIdentity.ts`
- Routed `markReversed` through ASCII-C require helper
- Length capped at 240 to match MISE-005FN CHECK bound
- Soft empty / inventing / over-long / control / non-string fail closed
- Left restaurant (#738), domain object ids (#772), approvedBy (#800), error,
  lesson, and requestedBy alone

## Verification

- focused AsciiC + miseActions tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. When landing with #800 drop the cross-assertion that `approvedBy`
still Unicode-trims. When landing with #772 drop the cross-assertion that
`idempotencyKey` still Unicode-trims. Keep modules separate; do not merge error
contracts with approvedBy (#800) or restaurant (#738).
