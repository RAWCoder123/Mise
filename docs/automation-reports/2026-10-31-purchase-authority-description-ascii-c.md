# MISE-005UQ: pin purchase-authority blocker descriptions to ASCII C

Date: 2026-10-31  
Branch: `cursor/mise-purchase-authority-description-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `normalizePurchaseAuthorityResult` Unicode-trimmed blocker descriptions
through shared `boundedString` before storing durable
`PurchaseAuthorityBlocker.description`
(`boundedString(blocker.description, 240) || "Purchase evidence needs attention."`).

- Em-space / NBSP-padded descriptions invent a clean description under Unicode
  `.trim()` (`'\u2003Need a fresh count before approval\u2003'.trim() ===
  'Need a fresh count before approval'`).
- Unicode-only space soft-empties into the intentional English
  `"Purchase evidence needs attention."` fallback (preserved).

Open tip #819 / MISE-005OK explicitly left blocker descriptions on their
Unicode-trim contract while pinning metadata string values.

## Change

- Add `services/domain/purchaseAuthorityDescriptionIdentity.ts` with ASCII C
  display-prep (fold NBSP, collapse C whitespace, ASCII-space trim) and soft
  empty→fallback bounding (max 240, silent truncate preserved).
- Route `services/domain/purchaseAuthority.ts` blocker descriptions through
  `boundedCanonicalPurchaseAuthorityDescription`.
- Leave sibling `boundedString` / `nullableString` surfaces alone
  (`recommendationId`, `inventoryItemId`, `supplierId`, `countEventId`,
  `countedAt`, `canonicalUnit`, recipe-revision keys, metadata map keys/values,
  evaluatedAt).

## Ownership

Owns domain `normalizePurchaseAuthorityResult` blocker `description`
presentation only. Does **not** own metadata values (#819), metadata keys
(#818), recipe-revision keys (#807), countEventId (#806), inventoryItemId
(#805), recommendationId (#804), supplierId (#803), or evaluatedAt.

## Merge note

Alone-OK. Keep module separate from #819 metadata values and sibling durable-id
tips. When landing with #819, drop any assertion that blocker descriptions
still Unicode-trim through `boundedString`.

## Verification

- Focused AsciiC: 3/3 pass (`tests/purchaseAuthorityDescriptionAsciiC.test.ts`)
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited recalculationCycles)
- Docker pgTAP unavailable in this environment
