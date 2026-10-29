# MISE-005TH Square catalog item external_catalog_item_id ASCII C

Date: 2026-10-29

## Scope

Pin Edge `normalizeCatalogItem` catalog item `id` → durable
`SquareCatalogRow.external_catalog_item_id` so Unicode `String#trim` cannot invent
a clean catalog item identity from NBSP / em-space padding.

## Inventing proof

Prior shared `stringField` path:

```text
('\u2003' + 'item-1' + '\u2003').trim() === 'item-1'
```

That invented clean `external_catalog_item_id` values used for POS catalog
mapping and later recipe / inventory matching. Soft-empty Unicode-only space
also collapsed through `.trim()` into the intentional empty `""` path (and the
variation-row filter then dropped those rows via
`Boolean(row.external_catalog_item_id)`).

## Change

- New `services/domain/squareCatalogItemExternalIdIdentity.ts`
  (MISE-005TH) with ASCII-end trim + fail-closed canonicalize / soft normalize.
- `normalizeCatalogItem` reads raw `record.id` and soft-nulls unsafe tokens via
  `normalizeSquareCatalogItemExternalId(...) ?? ""`.
- Soft empty / Unicode-padded / overlong / control-bearing tokens collapse to
  `""` without inventing a clean durable catalog item id.
- Left shared `stringField` and sibling catalog fields alone: variation `id` →
  `external_variation_id`, item `name` / `external_name`, `variation_name`,
  `product_type`, `category_id`.
- Module is separate from open #945
  `squareCatalogVariationExternalIdIdentity` (catalog variation list `id` →
  `external_variation_id`), #939 order-sale `catalog_object_id` →
  `provider_variation_id`, #943 location-list `externalLocationId`, and #944
  OAuth `merchant_id`.

## Verification

- Focused `tests/squareCatalogItemExternalIdAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
