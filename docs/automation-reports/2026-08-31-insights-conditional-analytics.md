# Insights conditional analytics (2026-08-31)

## Summary

Wired the existing `fetchConditionalAnalytics` / `buildConditionalAnalyticsSummary`
contract into the Insights Sales surface so supplier-order rhythm and evidence
readiness gates are visible, tenant-scoped, and localized.

## Changes

- Hardened `fetchConditionalAnalytics` with restaurant-id normalization and
  cross-collection scope validation.
- Supplier trend points now use ISO calendar-day keys (`YYYY-MM-DD`) so the UI
  can format dates for EN / ES / zh-Hans.
- Insights Sales loads conditional analytics with the other hub fetches, fails
  closed on soft-refresh errors via `hubReady`, and surfaces:
  - Evidence readiness for sales rhythm, ordering rhythm, and recipe coverage
  - Supplier order rhythm chart + day list when enough sent/completed orders exist
  - Empty states with deep links to Orders and Recipes when gates are waiting
- Added EN / ES / zh-Hans catalog keys and static + domain tests.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- `npm run security:static`

## Not in scope

- Inventing sales/order forecasts
- Changing recommendation quantities or purchase authority
- Hosted migration / pgTAP
- Overlapping open stacks (#187–#298)
