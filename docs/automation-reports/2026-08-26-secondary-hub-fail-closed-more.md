# Secondary hub soft-refresh fail-closed (more screens)

Date: 2026-08-26  
Branch: `cursor/mise-product-inspection-69b5`  
Base: `origin/main` @ `20b28e5`

## Gap

Primary hubs already used `resolveRestaurantScopedHubLoadState`. Remaining
restaurant-scoped secondary screens still treated `loadedRestaurantId` alone as
enough to show data after a soft-refresh load error, so RetryNotice could appear
while stale rows stayed visible. Task detail and POS mapping review also kept
complete/verify actions reachable on that stale state.

Open draft #151 contained the first pass; this tip rebases that intent onto
current main and closes Greptile P1 findings:

1. Task mutation `mutating` surviving restaurant switch (reset `setMutating(false)`).
2. Scan barcode matches bypassing hub readiness (gate matches + EmptyState on `hubReady`).

Avoided overlap with open drafts #145–#150, #152–#174, and #130–#135 / #146.

## Changes

Fail-close restaurant-scoped visibility (and mutations where applicable) on:

- `app/more/waste.tsx`
- `app/more/daily-brief.tsx`
- `app/more/daily-report.tsx`
- `app/more/scan-item.tsx` (items, barcode matches, EmptyState, camera scan)
- `app/tasks/[id].tsx` (separate `hubLoadError` vs mutation `error`; mutating cleared on switch)
- `app/settings/pos-mappings.tsx`

Pins extended in:

- `tests/hubLoadState.test.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/posMappingReviewWorkflow.test.ts`

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts tests/posMappingReviewWorkflow.test.ts`

## Classification

Controlled pilot-ready code tip. Not App Store submission-ready.
