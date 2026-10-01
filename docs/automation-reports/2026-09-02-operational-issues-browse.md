# Operational issues browse — 2026-09-02

## Completed
- Read-only More hub browse for durable `operational_issues`
- Domain mapping/filter/sort with tenant fail-closed checks
- Hosted SELECT via `listOperationalIssues`; demo mirrors purchase-recommendation upserts
- Demo export now includes `operational_issues` from state
- EN / ES / zh-Hans copy; route smoke entry

## Verification
- `npm run typecheck`
- focused tests: operationalIssues, demoOperationalIssues, restaurantDataExportClient
- `npm run security:static`
- `npm run design:static`
- full `npm test`: 636 pass / 0 fail / 7 cancelled (known recalculation timeout parent cancel)

## Classification
Controlled pilot-ready codebase; this slice closes the “zero client reads of operational_issues” gap without inventing new issue writers.
