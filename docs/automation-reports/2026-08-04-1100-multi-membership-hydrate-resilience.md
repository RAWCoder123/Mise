# Automation report — Multi-membership hydrate resilience

Date: 2026-08-04 ~11:00 UTC  
Branch: `cursor/mise-product-inspection-253f`

## Gap

`hydrateSupabaseUser` loaded every membership restaurant with `Promise.all`. One orphan, archived, or RLS-denied restaurant rejected the entire hydration, blocking every other workspace and often ejecting the operator even when a preferred/active restaurant was healthy.

## Fix

1. Fetch membership restaurants with `Promise.allSettled`.
2. Pure domain helper `resolveMultiMembershipHydration`:
   - keeps successfully loaded restaurants;
   - drops failed siblings with telemetry;
   - fail-closes (`PreferredWorkspaceHydrationError`) when an explicitly preferred membership cannot load;
   - fail-closes (`EmptyWorkspaceHydrationError`) when no restaurant loads;
   - falls back to the first loadable membership when preferred is absent/stale.
3. Session applies available restaurants only after resolution succeeds.

## Tests

- `tests/sessionHydration.test.ts` — settle/resolve unit coverage + session contract pin
- `tests/clientTenantSafety.test.ts` — `Promise.allSettled` / resolve helper pins

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
