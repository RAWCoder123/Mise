# MISE-005TN Square catalog product_type / category_id category ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `normalizeCatalogItem` Unicode-trimmed catalog item
`product_type` (with `category_id` fallback) through shared `stringField`
before storing durable `SquareCatalogRow.category` (with soft-empty falling
back to `"Square"`):

```text
('\u2003' + 'REGULAR' + '\u2003').trim() === 'REGULAR'
→ category = 'REGULAR'
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional `category_id` / `"Square"` fallback via `stringField` emptiness.

## Fix

New `services/domain/squareCatalogCategoryIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 80
- preserves the existing `|| "Square"` fallback for soft-empty / fail-closed
  paths without inventing a clean durable catalog category from padding
- covers both `product_type` (primary) and `category_id` (fallback) because
  both feed the same durable `category` through the same prior inventing path

Wired only into `normalizeCatalogItem` `product_type` / `category_id` on the
category path. Left shared `stringField` and sibling fields alone
(`id` → `external_catalog_item_id`, item `name` → `external_name`, variation
list `id` → `external_variation_id`, variation `name` composition). Left
order-sale / location-list / OAuth paths alone.

Do **not** share this module with:

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
- #937 / MISE-005SY `askMiseTopSaleItemNameIdentity`
- #929 / MISE-005SQ Square integration error haystacks

## Verification

- focused AsciiC tests
- `tests/squareBackend.test.ts` where applicable
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
