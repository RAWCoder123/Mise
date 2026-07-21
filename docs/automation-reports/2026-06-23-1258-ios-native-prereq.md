# Mise iOS Demo Readiness Automation Report

Run: 2026-06-23 12:58 America/New_York  
Automation: `mise-ios-demo-readiness`

## What changed

- Added `scripts/ios-native-prereq.mjs`, a native iOS preflight for demo machines.
- Added `npm run qa:ios-prereq`.
- The preflight validates Expo iOS identity, app icon, splash image, favicon, bundle identifier, build number, selected developer directory, `simctl`, and available iPhone simulator devices.
- Updated `docs/ios-demo-checklist.md` so the preflight must pass before the simulator walkthrough.
- Updated `README.md` so iOS demo setup does not jump straight to `npm run ios` on a Mac without simulator tooling.

## Files touched

- `scripts/ios-native-prereq.mjs`
- `package.json`
- `README.md`
- `docs/ios-demo-checklist.md`
- `docs/automation-reports/2026-06-23-1258-ios-native-prereq.md`

## Verification

- `node --check scripts/ios-native-prereq.mjs` passed.
- `npm run typecheck` passed.
- `npm run qa:routes` passed for `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.
- `npm run qa:ios-prereq` correctly failed on this Mac because full Xcode is not selected and `simctl` is unavailable. Validated before failure: app icon, splash image, favicon, bundle identifier `com.mise.mobile`, build number `1`, and developer directory `/Library/Developer/CommandLineTools`.

## Still needs to be done

- Install or open full Xcode on the demo Mac.
- Select full Xcode with:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

- Install an iPhone simulator runtime if Xcode does not already have one.
- Rerun `npm run qa:ios-prereq`; it should pass before running `npm run ios`.
- Complete the native iOS checklist, including first-run local demo, session resume, route sweep, and keyboard sweep.

## Recommended next step

Resolve the Xcode/simulator blocker, rerun `npm run qa:ios-prereq`, then run `npm run ios` and complete `docs/ios-demo-checklist.md`. Mise should not be marked demo-ready for iOS users until that native walkthrough passes.
