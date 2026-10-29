# MISE-005TD Square order-sale line uid ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `normalizeOrderSales` Unicode-trimmed line-item `uid` through shared
`stringField` before composing durable `SquareSaleRow.source_record_id` as
`square_${orderId}_${uid}` (with soft-empty falling back to `String(index)`):

```text
('\u2003' + 'line-1' + '\u2003').trim() === 'line-1'
→ source_record_id = 'square_order-1_line-1'
```

Soft empty / Unicode-only space also collapsed through `.trim()` into the
intentional `String(index)` fallback via `stringField` emptiness.

## Fix

New `services/domain/squareOrderSaleLineUidIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 128
- preserves the existing `?? String(index)` fallback for soft-empty /
  fail-closed paths without inventing a clean durable line uid from padding

Wired only into `normalizeOrderSales` line-item `uid`. Left shared
`stringField` and sibling fields alone (`id` → `source_record_id` order id,
`location_id`, `catalog_object_id`, item `name`, closed_at/created_at,
`variation_name`). Left `normalizeCatalogItem` item/variation names alone.

Do **not** share this module with:

- #941 / MISE-005TC `squareOrderSaleItemNameIdentity`
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
