# MISE-005TC Square order-sale item_name ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `normalizeOrderSales` Unicode-trimmed line-item `name` through shared
`stringField` before storing durable `SquareSaleRow.item_name` (with soft-empty
falling back to `"Untitled item"`):

```text
('\u2003' + 'Burger' + '\u2003').trim() === 'Burger'
→ item_name = 'Burger'
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional `"Untitled item"` fallback via `stringField` emptiness.

## Fix

New `services/domain/squareOrderSaleItemNameIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 160
- preserves the existing `?? "Untitled item"` fallback for soft-empty /
  fail-closed paths without inventing a clean durable item label from padding

Wired only into `normalizeOrderSales` line-item `name`. Left shared
`stringField` and sibling fields alone (`id` → `source_record_id`,
`location_id`, `catalog_object_id`, `uid`, closed_at/created_at,
`variation_name`). Left `normalizeCatalogItem` item/variation names alone.

Do **not** share this module with:

- #940 / MISE-005TB `squareOrderSaleSourceRecordOrderIdIdentity`
- #939 / MISE-005TA `squareOrderSaleProviderVariationIdIdentity`
- #938 / MISE-005SZ `squareOrderSaleProviderLocationIdIdentity`
- #937 / MISE-005SY `askMiseTopSaleItemNameIdentity`
- #936 / MISE-005SX `verifiedProviderLocationIdIdentity`
- #929 / MISE-005SQ Square integration error haystacks

## Verification

- focused AsciiC tests
- `tests/squareBackend.test.ts` where applicable
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
