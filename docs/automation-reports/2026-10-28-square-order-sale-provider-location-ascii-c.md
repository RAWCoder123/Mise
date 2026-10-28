# MISE-005SZ Square order-sale provider_location_id ASCII C

## Summary

Pins Edge `normalizeOrderSales` `location_id` → durable
`SquareSaleRow.provider_location_id` to ASCII C end trim so Unicode `.trim()`
cannot invent a clean provider location identity on ingested POS sale rows via
NBSP/em-space padding.

## Inventing proof

Prior path Unicode-trimmed provider `location_id` through shared `stringField`
before storing it on sale rows:

```text
'\u2003loc-a\u2003'
  .trim()
  === 'loc-a'
```

That invented a clean `provider_location_id`. Soft-empty Unicode-only spaces
also collapsed through `.trim()` into the intentional empty → `undefined`
drop. ASCII C prep leaves em-space / NBSP alone and fails closed
(`trimmed !== trimmed.trim()`). Soft empty / Unicode-only spaces, controls,
and overlong tokens also fail closed. ASCII whitespace still end-trims cleanly.

## Change

- Add `services/domain/squareOrderSaleProviderLocationIdIdentity.ts`
  (ASCII end trim + Unicode-padding / control / overlong fail-closed; max 128)
- Route `normalizeOrderSales` `location_id` in
  `supabase/functions/_shared/square.ts` through
  `normalizeSquareOrderSaleProviderLocationId`
- Leave shared `stringField` and sibling normalizeOrderSales fields
  (order `id`, `catalog_object_id`, item `name`, closed_at, etc.) alone
- Leave hosted verified-provider mapping `providerLocationId` hydrate alone
  (#936 / MISE-005SX)
- Do **not** share helpers with #936 verifiedProviderLocationIdIdentity or
  #929 squareIntegrationErrorMessageIdentity

## Verification

- Focused: `tests/squareOrderSaleProviderLocationIdAsciiC.test.ts` (4/4)
- `tests/squareBackend.test.ts` regression: pass
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test` (687 total / 680 pass / 0 fail / 7 cancelled inherited recalculationCycles; tip +4 vs main ~683)

## Merge note

Alone-OK with #936 / #929 and remaining Square `stringField` siblings. Keep
`squareOrderSaleProviderLocationIdIdentity.ts` separate.
