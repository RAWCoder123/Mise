# MISE-005TK Square location-list displayName ASCII C

Date: 2026-10-29

## Scope

Pin Edge `listSquareLocations` location `name` → durable
`SquareLocation.displayName` so Unicode `String#trim` cannot invent a clean
location display label from NBSP / em-space padding.

## Inventing proof

Prior shared `stringField` path:

```text
('\u2003' + 'Main Floor' + '\u2003').trim() === 'Main Floor'
```

That invented clean location display labels on `SquareLocation.displayName`,
used for POS location presentation, operator location pickers, and inventory
planning surfaces. Soft-empty Unicode-only space also collapsed through
`.trim()` into the intentional `"Square location"` fallback.

## Change

- New `services/domain/squareLocationDisplayNameIdentity.ts`
  (MISE-005TK) with ASCII-end trim + fail-closed canonicalize / soft normalize.
- `listSquareLocations` reads raw `record.name` and soft-nulls unsafe tokens
  via `normalizeSquareLocationDisplayName(...) ?? "Square location"`.
- Soft empty / Unicode-padded / overlong / control-bearing tokens collapse to
  the intentional `"Square location"` fallback without inventing a clean
  durable display label.
- Left shared `stringField` and sibling listSquareLocations fields alone:
  location `id` → `externalLocationId`, timezone raw length gate.
- Module is separate from open #943 `squareLocationExternalIdIdentity`
  (location `id` → `externalLocationId`), #938
  `squareOrderSaleProviderLocationIdIdentity`, #936
  `verifiedProviderLocationIdIdentity`, #948
  `squareCatalogVariationNameIdentity`, #947
  `squareCatalogItemExternalNameIdentity`, and #941
  `squareOrderSaleItemNameIdentity`.

## Verification

- Focused `tests/squareLocationDisplayNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
