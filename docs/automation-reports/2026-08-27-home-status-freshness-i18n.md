# Home restaurant-status freshness + confidence i18n (2026-08-27)

## Summary
Stacks on #211. Structured operating-brief data freshness and restaurant-status
confidence so Home can present EN/ES/zh-Hans provenance without leaking English
domain labels. Approval cards also show a localized confidence score beside the
rationale.

## Changes
- `DataFreshnessDescriptor` gains `missingCodes` + `ageHours` (English
  `missingData` / `label` retained for audits)
- Presentation helpers: `presentDataFreshnessLabel`,
  `presentRestaurantStatusConfidenceRationale`, `presentRestaurantStatusEvidence`
- Home status notice uses localized freshness message + meta provenance
- Approval confidence line includes numeric score when available
- Catalog keys for freshness states/missing codes and score formatting

## Verification
- `npm run typecheck`
- focused operatingBrief / presentation tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
