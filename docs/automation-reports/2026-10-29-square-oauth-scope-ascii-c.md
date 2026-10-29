# MISE-005TP Square OAuth scope ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `parseTokenSet` Unicode-trimmed OAuth `scope` through shared
`stringField` before splitting into durable `SquareTokenSet.grantedScopes`
(with soft-empty falling through required-scope checks →
`square_scope_missing`):

```text
('\u2003' + 'MERCHANT_PROFILE_READ ITEMS_READ ORDERS_READ' + '\u2003').trim()
=== 'MERCHANT_PROFILE_READ ITEMS_READ ORDERS_READ'
→ grantedScopes includes every required Square OAuth scope
→ SquareTokenSet.grantedScopes
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional empty → `square_scope_missing` fail path via `stringField`
emptiness.

## Fix

New `services/domain/squareOAuthScopeIdentity.ts`:

- ASCII-end-trims only (field and per-token)
- fail-closes (soft-empty `[]`) when Unicode padding remains, controls appear,
  or length exceeds the prior `stringField` / token bounds
- preserves the existing required-scope loop → `square_scope_missing` for
  soft-empty / fail-closed grants without inventing clean durable scope
  identity from padding

Wired only into `parseTokenSet` OAuth `scope` → `grantedScopes`. Left shared
`stringField` and sibling fields alone (`access_token`, `refresh_token`,
`merchant_id`, `expires_at`). Left `listSquareLocations` /
`normalizeOrderSales` / `normalizeCatalogItem` alone.

Do **not** share this module with:

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
