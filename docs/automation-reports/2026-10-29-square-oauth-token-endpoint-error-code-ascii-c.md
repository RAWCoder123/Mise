# MISE-005TQ Square OAuth token-endpoint error code ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `tokenEndpointError` Unicode-trimmed OAuth token-endpoint `code`
(falling back to `error`) through shared `stringField` before the
`code === "unauthorized_client"` reauthorize disposition gate:

```text
status = 400
('\u2003' + 'unauthorized_client' + '\u2003').trim() === 'unauthorized_client'
→ SquareProviderError("square_unauthorized", "reauthorize", 400)
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional empty → fall-through `square_token_exchange_failed` / `ambiguous`
path.

## Fix

New `services/domain/squareOAuthTokenEndpointErrorCodeIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 80
- preserves soft-empty / fail-closed codes as null so padded provider error
  codes cannot invent the `unauthorized_client` reauthorize disposition

Wired only into `tokenEndpointError` OAuth token-endpoint `code` / `error`.
Left shared `stringField` and sibling parseTokenSet fields alone
(`access_token`, `refresh_token`, `merchant_id`, `scope`, `expires_at`).
Left `listSquareLocations` / `normalizeOrderSales` / `normalizeCatalogItem`
alone.

Do **not** share this module with:

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
