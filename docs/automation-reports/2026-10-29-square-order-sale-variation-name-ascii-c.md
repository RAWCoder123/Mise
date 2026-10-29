# MISE-005TL Square order-sale variation_name category ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `normalizeOrderSales` Unicode-trimmed line-item `variation_name`
through shared `stringField` before storing durable `SquareSaleRow.category`
when no `catalog_object_id` was present (with soft-empty falling back to
`"Square"`):

```text
('\u2003' + 'Large' + '\u2003').trim() === 'Large'
→ category = 'Large'
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional `"Square"` fallback via `stringField` emptiness.

## Fix

New `services/domain/squareOrderSaleVariationNameIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 80
- preserves the existing `|| "Square"` fallback for soft-empty / fail-closed
  paths without inventing a clean durable category label from padding

Wired only into `normalizeOrderSales` line-item `variation_name` on the
category-fallback path. Left shared `stringField` and sibling fields alone
(`id` → `source_record_id`, `location_id`, `catalog_object_id`, `uid`,
`name` → `item_name`, closed_at/created_at). Left `normalizeCatalogItem`
`product_type` / `category_id` / item/variation names alone.

Do **not** share this module with:

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
