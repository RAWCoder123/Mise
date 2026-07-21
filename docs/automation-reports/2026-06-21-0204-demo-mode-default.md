# Mise iOS Demo Readiness Automation Report

Run time: 2026-06-21 02:04 America/New_York

## What Changed

- Updated public app configuration so development and staging builds default to local demo mode when `EXPO_PUBLIC_ENABLE_DEMO_MODE` is not set.
- Kept the production safeguard intact: production builds cannot expose demo mode or demo credentials, even if the demo flag is set.
- Added regression coverage for default development demo access and explicit demo opt-out.

## Files Touched

- `lib/appConfig.ts`
- `tests/security.test.ts`
- `docs/automation-reports/2026-06-21-0204-demo-mode-default.md`

## Verification

- `npm run typecheck` passed.
- `npm test` passed: 14 tests.
- Expo web server started at `http://localhost:8083`.
- Metro bundled successfully and showed the expected warning that Supabase env vars are absent.
- Route smoke checks returned HTTP 200 for `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.

## What Still Needs To Be Done

- Verify the first-run demo path on iOS simulator: open the app with no Supabase env vars, tap the local demo path, and confirm Setup can seed the restaurant.
- Run true mobile-width visual QA for the six required routes with a browser/simulator tool that can inspect overflow.
- Add final iOS build metadata and asset checks before TestFlight-style distribution.

## Recommended Next Step

Run the app in an iOS simulator without a `.env`, confirm local demo mode is available by default, then complete the required route sweep for clipped text and horizontal overflow.
