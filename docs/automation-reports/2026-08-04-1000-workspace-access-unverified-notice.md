# Automation report — Workspace access unverified StatusNotice

Date: 2026-08-04 ~10:00 UTC  
Branch: `cursor/mise-product-inspection-123d` (from `1fc0` @ `55282b6`)

## Gap

After fail-closed membership revalidation cleared the active restaurant, operators were redirected to `/setup` with no explanation. The security clear was correct; the UX looked like a silent eject into new-restaurant setup.

## Fix

1. `MiseSessionContext` exposes `workspaceAccessUnverified` and `clearWorkspaceAccessUnverified`.
2. The flag is set only on the denial fail-closed catch path (after `clearUnverifiedWorkspaceAccess`), not on ordinary revoked-membership clears that still hydrate other restaurants.
3. Successful membership hydrate and full session clear reset the flag.
4. Setup consumes the flag into a caution `StatusNotice` with en/es/zh-Hans copy explaining that access could not be re-confirmed.

## Tests

- Extended `tests/clientTenantSafety.test.ts` for the fail-closed flag contract.
- Extended `tests/setupCreatePresentation.test.ts` for setup wiring and localized copy.

## Remaining

- Docker/hosted security re-proof still required.
- Founder Auth redirect allowlist / privacy/support/terms HTTPS URLs / Apple/EAS/device QA still ops-blocked.

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
