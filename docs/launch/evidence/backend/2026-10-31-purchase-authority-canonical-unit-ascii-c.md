# MISE-005UT purchase-authority canonicalUnit ASCII C

Date: 2026-10-31  
Branch: `cursor/mise-purchase-authority-canonical-unit-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `normalizePurchaseAuthorityResult` Unicode-trimmed
`evidence.canonicalUnit` through shared `nullableString` / `boundedString`
before storing durable purchase-authority evidence. NBSP / em-space padding
therefore invented a clean unit token:

```text
'\u2003each\u2003'.trim() === 'each'
```

## Change

- Added `services/domain/purchaseAuthorityCanonicalUnitIdentity.ts` with ASCII
  end trim and fail-closed canonicalize. Soft empty / non-string soft-nulls;
  inventing / over-long / control tokens throw
  `Purchase authority canonicalUnit is invalid.`
- Routed `evidence.canonicalUnit` through
  `normalizeCanonicalPurchaseAuthorityCanonicalUnit` in
  `services/domain/purchaseAuthority.ts`.
- Left sibling `boundedString` / `nullableString` surfaces alone, including
  countedAt, evaluatedAt, blocker descriptions, durable IDs, metadata, recipe
  revision keys, and provider windows.

## Ownership

Owns domain `normalizePurchaseAuthorityResult` `evidence.canonicalUnit`
presentation only. Does **not** own countedAt (#983), evaluatedAt (#982),
blocker descriptions (#981), metadata values (#819), metadata keys (#818),
recipe-revision keys (#807), countEventId (#806), inventoryItemId (#805),
recommendationId (#804), supplierId (#803), or provider windows.

## Merge note

When landing with #983 / #982 / #806, drop mutual cross-assertions that the
sibling field still Unicode-trims. Keep
`purchaseAuthorityCanonicalUnitIdentity.ts` separate from countedAt /
evaluatedAt / description / metadata / durable-id / future provider-window
modules.

## Verification

- `npx tsc --noEmit` (via `npm run typecheck`)
- focused `tests/purchaseAuthorityCanonicalUnitAsciiC.test.ts`
- `tests/purchaseAuthority.test.ts`
- `npm run security:static`
- `npm run security:backend`
