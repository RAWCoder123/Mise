# Automation report — Gate restaurant create after fail-closed clear

Date: 2026-08-04 ~10:15 UTC  
Branch: `cursor/mise-product-inspection-123d`

## Gap

After fail-closed membership clear, setup explained the eject but still allowed `createRestaurant`. A transient membership-fetch failure after a tenant denial could mint an orphan restaurant and burn lifetime workspace quota while original memberships still existed server-side.

## Fix

1. Keep `workspaceAccessUnverified` until Retry (`confirmWorkspaceAccess`) proves restored membership or confirmed-empty memberships.
2. Setup shows caution StatusNotice + Retry; create CTA stays disabled while gated.
3. `createRestaurant` refuses while the unverified gate is active.
4. Confirmed-empty clears the gate so legitimate first-time create remains available.
5. Restored membership redirects to Today only when recovering from the fail-closed path (not during normal owner setup edits).

## Tests

- Presentation helpers for create-block + confirm outcome.
- Setup / session contract pins in `setupCreatePresentation.test.ts` and `clientTenantSafety.test.ts`.

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
