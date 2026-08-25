# Multi-membership session hydrate resilience (2026-08-25)

## Gap

`hydrateSupabaseUser` loaded every membership restaurant with `Promise.all`.
One orphan, archived, RLS-denied, or transient restaurant failure rejected the
entire session hydrate and cleared the operator out of every other workspace.

## Fix

- Add pure domain helpers in `services/domain/sessionHydration.ts`
  - `settleMembershipRestaurantFetches`
  - `resolveMultiMembershipHydration`
  - `PreferredWorkspaceHydrationError` / `EmptyWorkspaceHydrationError`
- Session hydrate uses `Promise.allSettled`, drops failed siblings with
  telemetry, and keeps loadable restaurants.
- Fail closed when the preferred active workspace cannot load.
- Fall back to the first loadable workspace when the preferred id is absent or
  stale (no matching active membership).
- Apply memberships and restaurant state only after successful resolution
  (empty membership list still clears immediately).

## Paths

- `services/domain/sessionHydration.ts`
- `contexts/MiseSessionContext.tsx`
- `tests/sessionHydration.test.ts`
- `tests/clientTenantSafety.test.ts`
- `docs/automation-reports/2026-08-25-session-hydrate-allsettled.md`

## Out of scope

- Does not overlap open soft-refresh / draft-preserve / readiness PRs (#130–#169)
- Does not change invite-only provisioning or restaurant creation
- Does not add `list_my_restaurant_memberships` RPC purity (separate hosted work)

## Verification

- `npm run typecheck`
- Targeted `sessionHydration` + `clientTenantSafety` tests
- Full `npm test`
