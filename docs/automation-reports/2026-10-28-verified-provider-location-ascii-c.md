# MISE-005SX: pin verified-provider mapping providerLocationId to ASCII C

Date: 2026-10-28

## Inventing proof

Prior `fetchVerifiedProviderMappings` Unicode-trimmed hosted
`pos_locations.external_location_id` before becoming durable
`VerifiedProviderSaleMapping.providerLocationId`:

```text
'\u2003L1ABCXYZ\u2003'
  .trim()
  === 'L1ABCXYZ'
```

The pre-map filter only checks `Boolean(location?.external_location_id)`, so
em-space-padded location ids stay truthy, pass verification gates, and then
invent a clean location identity used for POS→menu matching. Soft-empty
Unicode-only padding also collapsed through `.trim()` into the intentional
second-pass drop filter.

## Change

- Add `services/repositories/verifiedProviderLocationIdIdentity.ts`
- Route verified-provider mapping `providerLocationId` hydrate through
  `normalizeVerifiedProviderLocationId`
- ASCII end-trim only; fail closed when Unicode padding / controls remain
- Soft-null unsafe / empty tokens into `""` so the existing
  `row.providerLocationId` filter owns the drop
- Leave `sourcePos` Unicode `.trim()`, catalog/variation/menu IDs,
  mapping-review `requiredPosMappingString`, and domain
  `providerSaleIdentity.normalize` alone

## Verification

- Focused: `tests/verifiedProviderLocationIdAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`

## Merge note

Alone-OK with #935 / #934 / #933 / #932 / #931 / #930 / #929 / #465 and
remaining repository hydrate siblings. Keep
`verifiedProviderLocationIdIdentity.ts` separate from recipe-authority
`menuItemName`, supplier-send blocker codes, Edge error haystacks, and domain
`providerSaleIdentity`. When landing with other `supabaseRepository.ts` tips,
resolve textually — this tip owns only
`fetchVerifiedProviderMappings` `providerLocationId`. Do not tip `sourcePos`
through this module — tip that separately if inventing is proved outside the
`provider === "square"` equality gate.
