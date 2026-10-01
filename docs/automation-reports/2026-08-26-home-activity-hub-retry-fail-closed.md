# Home + Activity hub retry fail-closed (2026-08-26)

Branch: `cursor/mise-home-activity-retry-fail-closed`
Base: `origin/cursor/mise-product-inspection-9cd5` @ `7d62d76` (#176 intent on `origin/main` @ `20b28e5`)

## Gap (Greptile P1 on #176)

1. **Home:** After a successful load and a failed soft refresh, Retry cleared
   `error` while retaining `loadedRestaurantId`. `hubReady` briefly became true
   and one-tap approvals were actionable again before replacement data arrived.
2. **Activity:** After an initial load failure, `hasLoaded` was true while
   `loadedQueryRef` stayed null. Same-query Retry cleared the error without
   enabling loading, leaving a blank feed with no spinner, error, or empty state.

## Fix

- Track an explicit `readyProofRestaurantIdRef` for the last successful load.
- On load failure, invalidate that proof and clear `loadedRestaurantId`.
- Start a blocking load whenever ready proof is missing (Retry after failure,
  initial paint, restaurant switch, or Activity query change).
- Successful soft refresh with an intact ready proof still keeps last-known
  values visible without a full-screen spinner.

## Paths

- `app/(tabs)/home.tsx`
- `app/more/activity.tsx`
- `services/presentation/hubLoadState.ts` (consumer contract comment)
- `tests/pilotUiSafety.test.ts`
- this report

## Do not redo

- Home/Activity hubReady soft-refresh wiring (#176 / #150)
- Home/Orders pilot readiness UI (#177)
- Application/generation readiness gates (#178 / #179)

## Verification

- `npm run typecheck`
- `npm test -- tests/hubLoadState.test.ts tests/clientTenantSafety.test.ts tests/pilotUiSafety.test.ts`
