# Secondary hub soft-refresh fail-closed (more screens)

Date: 2026-08-25  
Branch: `cursor/mise-secondary-hub-fail-closed-more`  
Base: `origin/main` @ `706590d` (MISE-004A)

## Gap

Primary hubs and an earlier secondary-mutation pass already used
`resolveRestaurantScopedHubLoadState`. Several remaining restaurant-scoped
screens still treated `loadedRestaurantId` alone as enough to show data after a
soft-refresh load error, so RetryNotice could appear while stale rows stayed
visible. Task detail and POS mapping review also kept complete/verify actions
reachable on that stale state.

Avoided overlap with open drafts #145–#150 (Home/Activity/Today/Orders/Ask Mise
readiness) and #130–#135 / #146.

## Changes

Fail-close restaurant-scoped visibility (and mutations where applicable) on:

- `app/more/waste.tsx`
- `app/more/daily-brief.tsx`
- `app/more/daily-report.tsx`
- `app/more/scan-item.tsx`
- `app/tasks/[id].tsx` (separate `hubLoadError` vs mutation `error`)
- `app/settings/pos-mappings.tsx`

Pins extended in:

- `tests/hubLoadState.test.ts`
- `tests/clientTenantSafety.test.ts`

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts`

## Classification

Controlled pilot-ready code tip. Not App Store submission-ready.
