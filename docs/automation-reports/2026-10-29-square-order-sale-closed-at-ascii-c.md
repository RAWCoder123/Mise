# MISE-005TM Square order-sale closed_at / created_at sale_date ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `normalizeOrderSales` Unicode-trimmed order `closed_at` (with
`created_at` fallback) through shared `stringField` before slicing into durable
`SquareSaleRow.sale_date` (with soft-empty falling back to
`new Date().toISOString()`):

```text
('\u2003' + '2026-07-30T12:00:00.000Z' + '\u2003').trim() === '2026-07-30T12:00:00.000Z'
→ sale_date = '2026-07-30'
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional `new Date().toISOString()` fallback via `stringField` emptiness.

## Fix

New `services/domain/squareOrderSaleClosedAtIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 64
- preserves the existing `|| new Date().toISOString()` fallback for soft-empty /
  fail-closed paths without inventing a clean durable sale date from padding
- covers both `closed_at` (primary) and `created_at` (fallback) because both
  feed the same durable `sale_date` through the same prior inventing path

Wired only into `normalizeOrderSales` order `closed_at` / `created_at` on the
sale-date path. Left shared `stringField` and sibling fields alone
(`id` → `source_record_id`, `location_id`, `catalog_object_id`, `uid`,
`name` → `item_name`, `variation_name` → category). Left `normalizeCatalogItem`
`product_type` / `category_id` / item/variation names alone. Left OAuth
`expires_at` alone.

Do **not** share this module with:

- #950 / MISE-005TL `squareOrderSaleVariationNameIdentity`
- #942 / MISE-005TD `squareOrderSaleLineUidIdentity`
- #941 / MISE-005TC `squareOrderSaleItemNameIdentity`
- #940 / MISE-005TB `squareOrderSaleSourceRecordOrderIdIdentity`
- #939 / MISE-005TA `squareOrderSaleProviderVariationIdIdentity`
- #938 / MISE-005SZ `squareOrderSaleProviderLocationIdIdentity`
- #948 / MISE-005TJ `squareCatalogVariationNameIdentity`
- #947 / MISE-005TI `squareCatalogItemExternalNameIdentity`
- #937 / MISE-005SY `askMiseTopSaleItemNameIdentity`
- #929 / MISE-005SQ Square integration error haystacks

## Verification

- focused AsciiC tests
- `tests/squareBackend.test.ts` where applicable
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
