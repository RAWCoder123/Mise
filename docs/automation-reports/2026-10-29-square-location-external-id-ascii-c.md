# MISE-005TE Square location-list externalLocationId ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `listSquareLocations` Unicode-trimmed location `id` through shared
`stringField` before storing durable `SquareLocation.externalLocationId` (with
soft-empty falling through the `if (!id) return null` drop):

```text
('\u2003' + 'LOC_ABC123' + '\u2003').trim() === 'LOC_ABC123'
→ externalLocationId = 'LOC_ABC123'
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional empty → drop-null filter via `stringField` emptiness.

## Fix

New `services/domain/squareLocationExternalIdIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 128
- preserves the existing `if (!id) return null` drop for soft-empty /
  fail-closed paths without inventing a clean durable external location id
  from padding

Wired only into `listSquareLocations` location `id`. Left shared
`stringField` and sibling fields alone (display `name`, timezone). Left
`normalizeOrderSales` / `normalizeCatalogItem` / OAuth `merchant_id` alone.

Do **not** share this module with:

- #942 / MISE-005TD `squareOrderSaleLineUidIdentity`
- #941 / MISE-005TC `squareOrderSaleItemNameIdentity`
- #940 / MISE-005TB `squareOrderSaleSourceRecordOrderIdIdentity`
- #939 / MISE-005TA `squareOrderSaleProviderVariationIdIdentity`
- #938 / MISE-005SZ `squareOrderSaleProviderLocationIdIdentity`
- #937 / MISE-005SY `askMiseTopSaleItemNameIdentity`
- #936 / MISE-005SX `verifiedProviderLocationIdIdentity`
- #929 / MISE-005SQ Square integration error haystacks

## Verification

- focused AsciiC tests
- `tests/squareBackend.test.ts` where applicable
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
