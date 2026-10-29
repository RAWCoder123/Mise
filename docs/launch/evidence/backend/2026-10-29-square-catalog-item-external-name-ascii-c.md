# MISE-005TI Square catalog item external_name ASCII C

Date: 2026-10-29

## Scope

Pin Edge `normalizeCatalogItem` catalog item `item_data.name` → durable
`SquareCatalogRow.external_name` so Unicode `String#trim` cannot invent a clean
catalog external name from NBSP / em-space padding.

## Inventing proof

Prior shared `stringField` path:

```text
('\u2003' + 'Burger' + '\u2003').trim() === 'Burger'
```

That invented clean `external_name` values used for POS catalog presentation
and later recipe / inventory matching. Soft-empty Unicode-only space also
collapsed through `.trim()` into the intentional `"Untitled item"` fallback.

## Change

- New `services/domain/squareCatalogItemExternalNameIdentity.ts`
  (MISE-005TI) with ASCII-end trim + fail-closed canonicalize / soft normalize.
- `normalizeCatalogItem` reads raw `itemData.name` and soft-nulls unsafe tokens
  via `normalizeSquareCatalogItemExternalName(...) ?? "Untitled item"`.
- Soft empty / Unicode-padded / overlong / control-bearing tokens collapse to
  `"Untitled item"` without inventing a clean durable catalog external name.
- Left shared `stringField` and sibling catalog fields alone: catalog item
  `id` → `external_catalog_item_id`, variation `id` → `external_variation_id`,
  variation `name` / composed `variation_name`, `product_type`, `category_id`.
- Module is separate from open #946
  `squareCatalogItemExternalIdIdentity` (catalog item `id` →
  `external_catalog_item_id`), #945
  `squareCatalogVariationExternalIdIdentity` (catalog variation list `id` →
  `external_variation_id`), and #941 order-sale line-item `name` →
  `item_name`.

## Verification

- Focused `tests/squareCatalogItemExternalNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
