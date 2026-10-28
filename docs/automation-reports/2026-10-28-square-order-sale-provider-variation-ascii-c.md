# MISE-005TA Square order-sale provider_variation_id ASCII C

## Summary

Pins Edge `normalizeOrderSales` `catalog_object_id` → durable
`SquareSaleRow.provider_variation_id` to ASCII C end trim so Unicode `.trim()`
cannot invent a clean provider variation identity on ingested POS sale rows via
NBSP/em-space padding.

## Inventing proof

Prior path Unicode-trimmed line-item `catalog_object_id` through shared
`stringField` before storing it on sale rows:

```text
'\u2003var-1\u2003'
  .trim()
  === 'var-1'
```

That invented a clean `provider_variation_id`. Soft-empty Unicode-only spaces
also collapsed through `.trim()` into the intentional empty → `undefined`
drop. ASCII C prep leaves em-space / NBSP alone and fails closed
(`trimmed !== trimmed.trim()`). Soft empty / Unicode-only spaces, controls,
and overlong tokens also fail closed. ASCII whitespace still end-trims cleanly.

## Change

- Add `services/domain/squareOrderSaleProviderVariationIdIdentity.ts`
  (ASCII end trim + Unicode-padding / control / overlong fail-closed; max 128)
- Route `normalizeOrderSales` `catalog_object_id` in
  `supabase/functions/_shared/square.ts` through
  `normalizeSquareOrderSaleProviderVariationId`
- Leave shared `stringField` and sibling normalizeOrderSales fields
  (order `id`, `location_id`, item `name`, closed_at, uid, variation_name,
  etc.) alone
- Leave Square order-sale `provider_location_id` alone (#938 / MISE-005SZ)
- Leave hosted verified-provider mapping `providerLocationId` hydrate alone
  (#936 / MISE-005SX)
- Do **not** share helpers with #938 squareOrderSaleProviderLocationIdIdentity,
  #936 verifiedProviderLocationIdIdentity, or #929
  squareIntegrationErrorMessageIdentity

## Verification

- Focused: `tests/squareOrderSaleProviderVariationIdAsciiC.test.ts` (4/4)
- `tests/squareBackend.test.ts` regression: pass
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test` (results recorded at tip time)

## Merge note

Alone-OK with #938 / #936 / #929 and remaining Square `stringField` siblings.
Keep `squareOrderSaleProviderVariationIdIdentity.ts` separate.
