# MISE-005TO Square OAuth expires_at ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `parseTokenSet` Unicode-trimmed OAuth `expires_at` through shared
`stringField` before storing durable `SquareTokenSet.expiresAt` (with
soft-empty collapsing to an empty / nullable expiry):

```text
('\u2003' + '2026-10-29T12:00:00.000Z' + '\u2003').trim() === '2026-10-29T12:00:00.000Z'
→ expiresAt = '2026-10-29T12:00:00.000Z'
→ SquareTokenSet.expiresAt
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional empty expiresAt path via `stringField` emptiness.

## Fix

New `services/domain/squareOAuthExpiresAtIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 64
- preserves soft-empty / fail-closed expiry as `null` on `SquareTokenSet`
  without inventing a clean durable access-token expiry from padding and
  without failing the whole token exchange

Wired only into `parseTokenSet` OAuth `expires_at`. Left shared
`stringField` and sibling fields alone (`access_token`, `refresh_token`,
`scope`, `merchant_id`). Left `listSquareLocations` / `normalizeOrderSales` /
`normalizeCatalogItem` alone. Left order-sale `closed_at` / `created_at`
alone (#951).

Do **not** share this module with:

- #952 / MISE-005TN `squareCatalogCategoryIdentity`
- #951 / MISE-005TM `squareOrderSaleClosedAtIdentity`
- #950 / MISE-005TL `squareOrderSaleVariationNameIdentity`
- #949 / MISE-005TK `squareLocationDisplayNameIdentity`
- #948 / MISE-005TJ `squareCatalogVariationNameIdentity`
- #947 / MISE-005TI `squareCatalogItemExternalNameIdentity`
- #946 / MISE-005TH `squareCatalogItemExternalIdIdentity`
- #945 / MISE-005TG `squareCatalogVariationExternalIdIdentity`
- #944 / MISE-005TF `squareMerchantIdIdentity`
- #943 / MISE-005TE `squareLocationExternalIdIdentity`
- #942 / MISE-005TD `squareOrderSaleLineUidIdentity`
- #941 / MISE-005TC `squareOrderSaleItemNameIdentity`
- #940 / MISE-005TB `squareOrderSaleSourceRecordOrderIdIdentity`
- #939 / MISE-005TA `squareOrderSaleProviderVariationIdIdentity`
- #938 / MISE-005SZ `squareOrderSaleProviderLocationIdIdentity`
- #929 / MISE-005SQ Square integration error haystacks

## Verification

- focused AsciiC tests
- `tests/squareBackend.test.ts` where applicable
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
