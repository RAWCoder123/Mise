# Mise iOS Demo Readiness Automation Report

Run: 2026-06-23 18:04 America/New_York  
Automation: `mise-ios-demo-readiness`

## What changed

- Added reusable demo setup starter drafts in `services/domain/setupDrafts.ts`.
- Setup onboarding now opens with editable starter inventory, supplier, and recipe rows instead of an empty form.
- Starter rows cover enough baseline data for the iOS walkthrough: three inventory items, two suppliers, and a Chicken Bowl recipe mapping.
- Added domain regression coverage that the starter rows make setup reviewable and leave only Gmail sender setup incomplete.
- Updated the iOS demo checklist to verify that first-run Setup opens with editable starter rows.

## Files touched

- `services/domain/setupDrafts.ts`
- `app/(auth)/setup.tsx`
- `tests/miseDomain.test.ts`
- `docs/ios-demo-checklist.md`
- `docs/automation-reports/2026-06-23-1804-setup-starter-drafts.md`

## Verification

- `npm run typecheck` passed.
- `npm test` passed: 37 tests.
- `npm run qa:mobile-layout` passed at 390px width with no horizontal overflow on `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.
- `npm run qa:routes` passed for `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.
- `npm run design:static` passed.
- `npm run qa:ios-prereq` still fails because this Mac has Command Line Tools selected instead of full Xcode, so `simctl` is unavailable. App icon, splash image, favicon, bundle identifier, and build number validated before that failure.

## Still needs to be done

- Select/install full Xcode and confirm an iPhone simulator runtime is available.
- Rerun `npm run qa:ios-prereq` until it passes.
- Run `npm run ios` and complete the native checklist, including first-run setup, session resume, route sweep, and keyboard sweep.
- Apply hosted Supabase staging migrations before using live restaurant data.

## Recommended next step

Resolve the Xcode/simulator blocker, then run the native iOS walkthrough. The setup path is now less brittle for demo users because it starts from reviewable restaurant data instead of an empty onboarding form.
