# Home restaurant-status confidence rationale (2026-08-27)

## Summary
Stacks on #212. Surfaces localized restaurant-status confidence *rationale*
(not only the score numeral) on the Home status notice so operators can see
why confidence is high or low.

## Changes
- `presentRestaurantStatusEvidence` marks when rationale is distinct from
  freshness and embeds that rationale beside the score in `metaLine`
- Home status notice prefers approval `whyItMatters`, then distinct confidence
  rationale, before falling back to a bare status qualifier
- Catalog key `home.status.confidence.withRationale` for EN/ES/zh-Hans

## Verification
- `npm run typecheck`
- focused operatingBrief presentation tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
