# MISE-005TG Square catalog variation external_variation_id ASCII C

Date: 2026-10-29

## Scope

Pin Edge `normalizeCatalogItem` variation list `id` → durable
`SquareCatalogRow.external_variation_id` so Unicode `String#trim` cannot invent
a clean catalog variation identity from NBSP / em-space padding.

## Inventing proof

Prior shared `stringField` path:

```text
('\u2003' + 'var-1' + '\u2003').trim() === 'var-1'
```

That invented clean `external_variation_id` values used for POS catalog
mapping and later recipe / inventory matching. Soft-empty Unicode-only space
also collapsed through `.trim()` into the intentional empty `""` path.

## Change

- New `services/domain/squareCatalogVariationExternalIdIdentity.ts`
  (MISE-005TG) with ASCII-end trim + fail-closed canonicalize / soft normalize.
- `normalizeCatalogItem` reads raw `row.id` and soft-nulls unsafe tokens via
  `normalizeSquareCatalogVariationExternalId(...) ?? ""`.
- Soft empty / Unicode-padded / overlong / control-bearing tokens collapse to
  `""` without inventing a clean durable variation id.
- Left shared `stringField` and sibling catalog fields alone: item `id` →
  `external_catalog_item_id`, item `name` / `external_name`, `variation_name`,
  `product_type`, `category_id`.
- Module is separate from open #939
  `squareOrderSaleProviderVariationIdIdentity` (order-sale
  `catalog_object_id` → `provider_variation_id`), #943 location-list
  `externalLocationId`, and #944 OAuth `merchant_id`.

## Verification

- Focused `tests/squareCatalogVariationExternalIdAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
