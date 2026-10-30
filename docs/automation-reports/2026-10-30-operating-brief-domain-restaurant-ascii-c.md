# MISE-005UN operating-brief domain restaurant ASCII C (2026-10-30)

## Summary

Stop Unicode `.trim()` on domain `buildOperatingBrief` `input.restaurant.id` from inventing a clean restaurant workspace identity via NBSP/em-space padding before tenant-scope checks.

## Inventing proof

Prior domain path:

```text
'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'
```

That invented workspace id was then used to scope sales, inventory, recommendations, orders, and insights inside `buildOperatingBrief`. Soft empty / Unicode-only space also collapsed through `.trim()` into the intentional `Operating brief requires a restaurant id.` failure.

Open application tip #746 / MISE-005LP already pins `fetchOperatingBrief` workspace prep and left this domain `buildOperatingBrief` path on Unicode trim.

## Change

- Add `services/domain/operatingBriefDomainRestaurantIdentity.ts` (ASCII end trim; fail closed on Unicode padding / controls / over-long / non-string)
- Route `buildOperatingBrief` through `requireCanonicalOperatingBriefDomainRestaurantId`
- Preserve `Operating brief requires a restaurant id.`
- Leave application `#746` `operatingBriefRestaurantIdentity.ts` alone
- Leave `impact.title.trim()` emptiness-only gates alone

## Verification

- Focused AsciiC: 3/3
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge note

Alone-OK relative to #746. Keep `operatingBriefDomainRestaurantIdentity.ts` separate from application `operatingBriefRestaurantIdentity.ts` and from #747 daily-phase-brief restaurant identity.
