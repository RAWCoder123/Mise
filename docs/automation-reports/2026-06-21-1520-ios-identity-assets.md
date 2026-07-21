# Mise iOS Demo Readiness Automation Report

Run time: 2026-06-21 15:20 America/New_York

## What Changed

- Added first-party demo brand assets for install and launch surfaces: app icon, splash mark, and web favicon.
- Updated `app.json` with Expo icon, splash, favicon, warm background color, iOS bundle identifier, build number, tablet setting, and non-exempt encryption declaration.
- Added `docs/ios-demo-checklist.md` so the iOS walkthrough has a repeatable build identity, first-run, route sweep, and operator-flow checklist.
- Linked the iOS demo checklist from `README.md`.
- Updated the security test expectation to match the current hardened Supabase schema, which uses private RLS helper functions plus a public restaurant-creation wrapper.

## Files Touched

- `assets/app-icon.png`
- `assets/splash-icon.png`
- `assets/favicon.png`
- `app.json`
- `README.md`
- `docs/ios-demo-checklist.md`
- `tests/security.test.ts`
- `docs/automation-reports/2026-06-21-1520-ios-identity-assets.md`

## Verification

- `npm run typecheck` passed.
- `npm test` passed: 14 tests.
- `sips` confirmed asset sizes: app icon 1024x1024, splash icon 512x512, favicon 96x96.
- `npx expo config --type public` passed and showed the new icon, splash, favicon, and iOS metadata.
- `npx expo export --platform web --output-dir /tmp/mise-web-export` passed.

## What Still Needs To Be Done

- Run the checklist on an iOS simulator or physical iPhone, especially first-run demo setup and close/reopen session resume.
- Complete mobile-width visual QA for `/today`, `/inventory`, `/orders`, `/insights`, `/setup`, and `/settings`.
- Replace the demo-generated brand assets with final approved logo files if a production logo package becomes available.

## Recommended Next Step

Run `npm run ios`, walk through `docs/ios-demo-checklist.md`, and fix any route-level overflow or iOS-specific safe-area issues discovered on the simulator.
