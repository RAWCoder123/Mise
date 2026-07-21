# Mise iOS Demo Readiness Automation Report

Run time: 2026-06-21 20:20 America/New_York

## What Changed

- Made local demo setup inputs affect the seeded demo data instead of acting only as UI copy.
- The setup path now passes supplier names, common inventory item names, and recipe baseline text into the demo seed process.
- Added demo seed transformation logic that can customize supplier assignment, rename seeded stock items, and parse simple recipe baseline lines such as `Chicken Bowl: chicken breast 0.25 lbs, rice 0.4 lbs`.
- Threaded the optional setup profile through local store, repository, service, and session context layers while preserving existing default demo behavior.
- Added regression coverage so the setup inputs remain connected to seeded demo data.

## Files Touched

- `app/(auth)/setup.tsx`
- `contexts/MiseSessionContext.tsx`
- `services/demoData.ts`
- `services/localStore.ts`
- `services/miseService.ts`
- `services/repositories/miseRepository.ts`
- `tests/miseDomain.test.ts`
- `docs/automation-reports/2026-06-21-2020-demo-setup-inputs.md`

## Verification

- `npm run typecheck` passed.
- `npm test` passed: 16 tests.
- Expo web server started at `http://localhost:8083`.
- Metro bundled successfully and showed the expected warning that Supabase env vars are absent.
- Route smoke checks returned HTTP 200 for `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.

## What Still Needs To Be Done

- Run an iOS simulator walkthrough to confirm customized demo setup values appear in Settings, Inventory, recipe coverage, and supplier recommendations.
- Complete true mobile-width overflow QA on the required routes.
- Consider expanding setup parsing later to support adding entirely new inventory items and new menu items, not only customizing the seeded demo set.

## Recommended Next Step

Use the iOS simulator to create a customized local demo kitchen from Setup, then verify the edited suppliers, stock item names, and recipe baselines carry through Today, Inventory, Orders, and Settings.
