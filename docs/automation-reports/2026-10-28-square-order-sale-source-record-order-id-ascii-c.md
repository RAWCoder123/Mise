# MISE-005TB Square order-sale source_record_id order id ASCII C

Date: 2026-10-28

## Inventing proof

Prior Edge `normalizeOrderSales` Unicode-trimmed order `id` through shared
`stringField` before composing durable `SquareSaleRow.source_record_id` as
`square_${orderId}_${uid}`:

```text
('\u2003' + 'order-1' + '\u2003').trim() === 'order-1'
→ source_record_id = 'square_order-1_line-1'
```

Soft empty / Unicode-only space also invented the intentional empty → drop-all
sales branch via `stringField` `.trim()` emptiness.

## Fix

New `services/domain/squareOrderSaleSourceRecordOrderIdIdentity.ts`:

- ASCII-end-trims only
- fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 128
- preserves the existing `if (!orderId) return []` drop

Wired only into `normalizeOrderSales` order `id`. Left shared `stringField`
and sibling fields alone (`location_id`, `catalog_object_id`, item `name`,
`uid`, closed_at/created_at, variation_name).

Do **not** share this module with:

- #938 / MISE-005SZ `squareOrderSaleProviderLocationIdIdentity`
- #939 / MISE-005TA `squareOrderSaleProviderVariationIdIdentity`
- #936 / MISE-005SX `verifiedProviderLocationIdIdentity`
- #929 / MISE-005SQ Square integration error haystacks

## Verification

- focused AsciiC tests
- `tests/squareBackend.test.ts` where applicable
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
