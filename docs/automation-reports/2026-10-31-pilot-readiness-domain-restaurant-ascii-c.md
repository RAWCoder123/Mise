# MISE-005UZ pilot-readiness domain restaurant ASCII C (2026-10-31)

## Summary

Stop Unicode `.trim()` on domain `buildPilotReadiness` `input.restaurantId` from inventing a clean restaurant workspace identity via NBSP/em-space padding before tenant-scope checks.

## Inventing proof

Prior domain path:

```text
'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'
```

That invented workspace id was then used to scope POS integrations, sales, inventory, counts, recipes, recipients, and email connection evidence inside `buildPilotReadiness`. Soft empty / Unicode-only space also collapsed through `.trim()` into the intentional `Pilot readiness requires a restaurant id.` failure.

Open application tip #745 / MISE-005LO already pins `fetchPilotReadiness` workspace prep and left this domain `buildPilotReadiness` path on Unicode trim.

## Change

- Add `services/domain/pilotReadinessDomainRestaurantIdentity.ts` (ASCII end trim; fail closed on Unicode padding / controls / over-long / non-string)
- Route `buildPilotReadiness` through `requireCanonicalPilotReadinessDomainRestaurantId`
- Preserve `Pilot readiness requires a restaurant id.`
- Leave application `#745` `pilotReadinessRestaurantIdentity.ts` alone
- Leave `#826` supplier_id and `#875` sale item-name tips alone

## Verification

- Focused AsciiC
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge note

Alone-OK relative to #745. Keep `pilotReadinessDomainRestaurantIdentity.ts` separate from application `pilotReadinessRestaurantIdentity.ts`. When landing with #745, keep both restaurant branches; drop any assertion that domain `input.restaurantId.trim()` still Unicode-trims on `buildPilotReadiness`.
