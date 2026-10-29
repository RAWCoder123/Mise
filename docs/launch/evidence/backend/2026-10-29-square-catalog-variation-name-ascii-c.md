# MISE-005TJ Square catalog variation name ASCII C

Date: 2026-10-29

## Scope

Pin Edge `normalizeCatalogItem` catalog variation `item_variation_data.name`
used when composing durable `SquareCatalogRow.external_name` so Unicode
`String#trim` cannot invent a clean variation label from NBSP / em-space
padding.

## Inventing proof

Prior shared `stringField` path:

```text
('\u2003' + 'Large' + '\u2003').trim() === 'Large'
```

That invented clean variation labels inside composed `external_name` values
such as `"Burger — Large"`, used for POS catalog presentation, recipe mapping
lookup surfaces, and inventory planning. Soft-empty Unicode-only space also
collapsed through `.trim()` into the intentional item-name-only composition
path.

## Change

- New `services/domain/squareCatalogVariationNameIdentity.ts`
  (MISE-005TJ) with ASCII-end trim + fail-closed canonicalize / soft normalize.
- `normalizeCatalogItem` reads raw `variationData.name` and soft-nulls unsafe
  tokens via `normalizeSquareCatalogVariationName(...)`.
- Soft empty / Unicode-padded / overlong / control-bearing tokens keep
  composition on the item-name-only branch without inventing a clean durable
  variation label.
- Left shared `stringField` and sibling catalog fields alone: item `id` →
  `external_catalog_item_id`, item `name` / `external_name`, variation list
  `id` → `external_variation_id`, `product_type`, `category_id`.
- Module is separate from open #947
  `squareCatalogItemExternalNameIdentity` (catalog item `name` /
  `external_name`), #946 `squareCatalogItemExternalIdIdentity`, #945
  `squareCatalogVariationExternalIdIdentity`, #941
  `squareOrderSaleItemNameIdentity`, and order-sale line `variation_name`
  category fallback.

## Verification

- Focused `tests/squareCatalogVariationNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
