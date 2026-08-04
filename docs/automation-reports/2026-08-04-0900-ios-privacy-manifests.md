# Automation report — iOS privacy manifests scaffold

Date: 2026-08-04 ~09:00 UTC  
Branch: `cursor/mise-product-inspection-1fc0` (reset from `cursor/mise-product-inspection-4469`)

## Completed

- Added app-level `expo.ios.privacyManifests.NSPrivacyAccessedAPITypes` aggregating required-reason APIs from shipped dependency `PrivacyInfo.xcprivacy` files:
  - UserDefaults `CA92.1` (expo-constants, expo-localization, react-native)
  - FileTimestamp `0A2A.1`, `3B52.1`, `C617.1` (expo-file-system, AsyncStorage, react-native)
  - DiskSpace `85F4.1`, `E174.1` (expo-file-system)
- Pinned the aggregate in `scripts/ios-native-prereq.mjs` and `tests/security.test.ts`.
- Documented completion in App Store + TestFlight readiness docs.

## Why

Apple does not always parse PrivacyInfo files from static CocoaPods dependencies. App-level aggregation avoids ITMS-91053 App Store / TestFlight upload blockers for known AsyncStorage / Expo / RN APIs.

## Workflows

- No operator workflow change. Improves App Store submission readiness for EAS iOS builds.

## Remaining

- Docker/hosted security re-proof still required before raising pilot classification.
- Founder privacy/support/terms HTTPS URLs, Apple Developer / TestFlight device QA, live POS/Gmail remain external.
- First TestFlight upload may still surface additional ITMS-91053 categories; fold those into the same app.json aggregate.

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
