# Ask Mise soft-refresh fail-closed (2026-08-26)

## Problem

`app/ask-mise.tsx` kept last-known today summary and insights after a soft-refresh load error. Because visibility was keyed only on `loadedRestaurantId === restaurant.id`, Ask Mise stayed answerable from stale operational evidence while `RetryNotice` was already showing.

## Change

- Wire shared `resolveRestaurantScopedHubLoadState` / `presentRestaurantScopedHubActionsEditable`.
- Gate `visibleSummary`, `visibleInsights`, and `visibleMessages` on `hubReady`.
- Disable suggestion chips, composer input, and send until the hub is ready and not busy.
- Reject new asks when `!hubReady`.

## Non-goals

- Does not add pilot readiness grounding (open #149).
- Does not touch Home/Activity (#150), secondary hubs (#151), or Create Task false-empty (#173).

## Verification

- `npm run typecheck`
- Targeted: `tests/hubLoadState.test.ts`, `tests/clientTenantSafety.test.ts`
