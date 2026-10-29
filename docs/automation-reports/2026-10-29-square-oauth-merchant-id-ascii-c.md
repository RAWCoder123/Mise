# MISE-005TF Square OAuth merchant_id ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `parseTokenSet` Unicode-trimmed OAuth `merchant_id` through shared
`stringField` before storing durable `SquareTokenSet.merchantId` (with
soft-empty falling through `if (!accessToken || !merchantId)` →
`token_response_invalid`):

```text
('\u2003' + 'ML_ABC123' + '\u2003').trim() === 'ML_ABC123'
→ merchantId = 'ML_ABC123'
→ p_merchant_id / SquareTokenSet.merchantId
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional empty → `token_response_invalid` fail path via `stringField`
emptiness.

## Fix

New `services/domain/squareMerchantIdIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 128
- preserves the existing `if (!accessToken || !merchantId)` fail-closed path
  for soft-empty / fail-closed tokens without inventing a clean durable
  merchant id from padding

Wired only into `parseTokenSet` OAuth `merchant_id`. Left shared
`stringField` and sibling fields alone (`access_token`, `refresh_token`,
`scope`, `expires_at`). Left `listSquareLocations` / `normalizeOrderSales` /
`normalizeCatalogItem` alone. Left webhook payload `merchant_id`
pass-through alone.

Do **not** share this module with:

- #943 / MISE-005TE `squareLocationExternalIdIdentity`
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
