# MISE-005VB hosted recalculation-record restaurant ASCII C (2026-10-31)

## Summary

Stop Unicode `.trim()` on hosted `recordRecalculationRun` `input.restaurantId` from inventing a clean restaurant workspace identity via NBSP/em-space padding before tenant-scope validation.

## Inventing proof

Prior hosted path:

```text
'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'
```

That invented workspace id was then compared against the persisted recalculation-run row inside supabaseRepository `recordRecalculationRun`. Soft empty / Unicode-only space also collapsed through `.trim()` into a mismatch against a real persisted id, or into an invented clean match when the row already held the unpadded tenant id.

Open transport tip #734 / MISE-005LD already pins `recordRecalculationRunRpcArguments` workspace prep and left this hosted scope-check `.trim()` call site alone.

## Change

- Add `services/repositories/recalculationRecordRestaurantIdentity.ts` (ASCII end trim; fail closed on Unicode padding / controls / over-long / non-string)
- Route hosted `recordRecalculationRun` through `requireCanonicalRecalculationRecordRestaurantId`
- Preserve `Recalculation run failed restaurant scope validation.`
- Leave transport `#734` `recalculationRunTransportRestaurantIdentity.ts` alone
- Leave hosted restaurant-tasks create/complete (`#991`) alone

## Verification

- Focused AsciiC
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge note

Alone-OK relative to #734. Keep `recalculationRecordRestaurantIdentity.ts` separate from transport `recalculationRunTransportRestaurantIdentity.ts`. When landing with #734, keep both restaurant branches; drop any assertion that transport still Unicode-trims `input.restaurantId` once #734 owns that path, and drop any assertion that hosted record still Unicode-trims once this tip owns that path. When landing with #991, drop #991's assertion that `recordRecalculationRun` still Unicode-trims `input.restaurantId`.
