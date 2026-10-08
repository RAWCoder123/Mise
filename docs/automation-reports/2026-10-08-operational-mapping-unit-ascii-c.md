# MISE-005KN operationalMapping unit ASCII C (2026-10-08)

## Problem

`normalizeUnit` in `services/domain/operationalMapping.ts` used Unicode-aware
`trim()` / `toLocaleLowerCase()` and a Unicode `\s` whitespace collapse before
looking up mass/volume/count aliases. Kelvin sign `K` folds to ASCII `k` under
those APIs, so `Kg` / `KG` invent the `kg` alias and convert as 1000× grams —
corrupting forecast/draft quantity conversion for unverified lookalike units.

## Change

- Client-only pin in `services/domain/operationalMapping.ts` (MISE-005KN)
- ASCII A–Z case fold + ASCII whitespace trim/collapse
- Preserve `.` stripping so aliases like `fl. oz.` still resolve
- Focused static + behavioral tests; this report

## Complements

- Open MISE-005JA / #669 (`inventoryUnits` client helpers)
- Open MISE-005IV / #664 (canonical-unit SQL `lower(... COLLATE "C")`)

Does not rewrite inventoryUnits, SQL helpers, or pack/density verification
authority. Alone-OK beside those tips.

## Verification

- `npm run typecheck`
- focused `tests/operationalMappingUnitAsciiC.test.ts` + `tests/operationalMapping.test.ts`
- `npm test`
- `npm run security:static` + `npm run security:backend`
