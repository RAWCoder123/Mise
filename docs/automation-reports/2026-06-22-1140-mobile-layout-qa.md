# Mise iOS Demo Readiness Automation Report

Run time: 2026-06-22 11:40 America/New_York

## What Changed

- Added `scripts/mobile-layout-smoke.mjs`, a local rendered mobile layout QA script.
- The script starts Expo web, launches headless Chrome with an iPhone-sized viewport, renders `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`, and fails on horizontal overflow, sparse render output, wide elements, or runtime errors.
- Added `npm run qa:mobile-layout`.
- Updated `README.md` and `docs/ios-demo-checklist.md` to document both route-shell QA and rendered mobile layout QA.

## Files Touched

- `scripts/mobile-layout-smoke.mjs`
- `package.json`
- `README.md`
- `docs/ios-demo-checklist.md`
- `docs/automation-reports/2026-06-22-1140-mobile-layout-qa.md`

## Verification

- `npm run qa:mobile-layout` passed at 390x844 viewport:
  - all checked routes reported `overflowX=0`
  - no wide elements were reported
  - no runtime errors were reported
- `npm run typecheck` passed.
- `npm test` passed: 25 tests.
- `npm run qa:routes` passed.
- `npm run security:static` passed.

## What Still Needs To Be Done

- This is Chrome mobile emulation, not an iOS simulator or physical iPhone run.
- Run `npm run ios` and complete the manual checklist on an actual simulator/device.
- Add screenshot capture if future review needs visual evidence artifacts, not only numeric overflow checks.

## Recommended Next Step

Run the simulator walkthrough from `docs/ios-demo-checklist.md`. If it matches the passing Chrome layout smoke results, Mise is close to a demoable local iOS walkthrough.
