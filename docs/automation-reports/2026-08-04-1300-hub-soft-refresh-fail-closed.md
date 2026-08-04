# Automation report — Hub soft-refresh fail-closed

Date: 2026-08-04 ~13:00 UTC  
Branch: `cursor/mise-product-inspection-1f5e`

## Gap

Restaurant-scoped hub and detail load-state helpers treated a prior successful load as `"ready"` even when a later soft-refresh set `loadError: true`. After a tenant-authorization denial (or ordinary refresh failure), RetryNotice could show while inventory, orders, Today metrics, and mutation affordances remained interactive from stale restaurant data until membership revalidation finished clearing the workspace.

Identity settings already checked `loadError` before loaded-restaurant match; hubs did not.

## Fix

1. Added `services/presentation/hubLoadState.ts` with `resolveRestaurantScopedHubLoadState`.
2. Delegated Today, Inventory, Orders, Insights, Recipes, Settings, POS, Suppliers, Team, Gmail, inventory count, inventory detail, and order detail resolvers to the shared helper.
3. Soft-refresh may still keep last-known component state for retry UX, but visible/actionable hub readiness now returns `"error"` whenever `loadError` is true.
4. Updated presentation tests that previously pinned soft-keep `"ready"` behavior; added `tests/hubLoadState.test.ts` and a `clientTenantSafety` contract pin.

## Verification

- `npm run typecheck`
- `npm test` (555 passing)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
