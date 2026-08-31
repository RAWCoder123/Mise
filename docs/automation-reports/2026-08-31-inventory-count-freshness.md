# Inventory count freshness surfacing — 2026-08-31

## Summary

Surface stale and unverified inventory count freshness on the Inventory hub and
item detail so operators recount before ordering from untrusted projections.

## Changes

- `services/presentation/inventoryCountFreshnessPresentation.ts` — trust-state helpers
- `i18n/inventoryPresentation.ts` — stale/unverified localized prediction copy
- `i18n/catalog.ts` — EN / ES / zh-Hans recount strings
- `app/(tabs)/inventory.tsx` — Needs recount group + filter + row hints
- `app/inventory/[id].tsx` — StatusNotice + Add to order gate
- `services/application/inventory.ts` — fail-closed add-to-order for stale/unverified
- Tests: `inventoryCountFreshnessPresentation.test.ts`, `inventoryCountFreshnessUi.test.ts`

## Verification

- `npm run typecheck`
- `npm test` (targeted + full suite)

## Notes

- Distinct from contaminated chronology UI (#310) and canonical-unit Needs verification (#307).
- Contaminated projections still fail closed for Add to order without claiming #310 copy.
