# MISE-005ML purchaseLines sourceDocumentReference ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-purchase-lines-sourcedoc-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pinned purchase-lines application `ingestPurchaseLines` `sourceDocumentReference`
to ASCII-only end trim via `services/domain/purchaseLinesSourceDocumentIdentity.ts`.

Unicode `.trim()` invents an invoice / credit-memo key when NBSP or em-space
pads a valid reference (for example `\u00a0INV-4471\u00a0` becomes `INV-4471`).
ASCII-C end trim leaves that padding in place, and canonicalize fails closed so
ingestion throws `A source document reference is required.` instead of writing
under an invented document identity.

## Scope boundaries

- Left restaurant workspace on Unicode trim for #728 / MISE-005KY.
- Left `correctPurchaseLine` `lineId` on Unicode trim for #764 / MISE-005MH.
- Left `normalizePurchaseLineInput` field trim surfaces alone.
- Max length 200 matches hosted `purchase_lines.source_document_reference`.
- Non-UUID operator document keys intentionally preserved.

## Verification

- `npm run typecheck`
- Focused `tests/purchaseLinesSourceDocumentAsciiC.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`

## Merge note

When landing with #728 and/or #764, keep restaurant, lineId, and
sourceDocumentReference branches in `purchaseLines.ts`. Drop #764’s assertion
that `sourceDocumentReference` still Unicode-trims. #728 owns restaurant; #764
owns lineId; this tip owns sourceDocumentReference.
