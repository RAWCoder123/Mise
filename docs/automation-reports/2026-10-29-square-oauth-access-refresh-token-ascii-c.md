# MISE-005TR Square OAuth access/refresh token ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `parseTokenSet` Unicode-trimmed OAuth `access_token` /
`refresh_token` through shared `stringField` before storing them on
`SquareTokenSet`:

```text
('\u2003' + 'square-access-token-with-enough-bytes' + '\u2003').trim()
  === 'square-access-token-with-enough-bytes'
→ accepted as SquareTokenSet.accessToken (Bearer / vault credential)

('\u2003' + 'square-refresh-token-with-enough-bytes' + '\u2003').trim()
  === 'square-refresh-token-with-enough-bytes'
→ accepted as SquareTokenSet.refreshToken (Vault refresh credential)
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional empty → `token_response_invalid` / `refresh_token_missing` paths.

## Fix

New `services/domain/squareOAuthAccessRefreshTokenIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 4096
- preserves soft-empty / fail-closed tokens as null so padded provider
  credentials cannot invent durable `SquareTokenSet` access/refresh identity

Wired only into `parseTokenSet` OAuth `access_token` / `refresh_token`.
Left shared `stringField` and sibling parseTokenSet fields alone
(`merchant_id`, `scope`, `expires_at`).
Left `tokenEndpointError` / `listSquareLocations` / `normalizeOrderSales` /
`normalizeCatalogItem` alone.

Do **not** share this module with:

- #955 / MISE-005TQ `squareOAuthTokenEndpointErrorCodeIdentity`
- #954 / MISE-005TP `squareOAuthScopeIdentity`
- #953 / MISE-005TO `squareOAuthExpiresAtIdentity`
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
