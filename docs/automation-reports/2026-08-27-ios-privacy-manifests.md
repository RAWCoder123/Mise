# iOS privacy manifests (required-reason APIs)

Date: 2026-08-27  
Branch: `cursor/mise-ios-privacy-manifests`  
Base: `origin/main` @ `20b28e5`

## Problem

EAS/App Store builds only declared required-reason API usage inside dependency
`PrivacyInfo.xcprivacy` files. Apple’s static analysis often misses those and
rejects uploads with ITMS-91053. Closed PR #113 patched this on 2026-08-04 but
never landed on `main`.

## Change

- Aggregate UserDefaults (`CA92.1`), FileTimestamp (`0A2A.1`, `3B52.1`, `C617.1`),
  and DiskSpace (`85F4.1`, `E174.1`) into `expo.ios.privacyManifests` in `app.json`.
- Pin the contract in `scripts/ios-native-prereq.mjs` and `tests/security.test.ts`.
- Document the gate in `docs/testflight-readiness.md`.

Sources for the reason codes: AsyncStorage, expo-constants, expo-localization,
expo-file-system, and React Native PrivacyInfo files.

## Out of scope

- Membership revalidation fail-closed (also in closed #113) — deferred because
  open PR #170 already edits `contexts/MiseSessionContext.tsx`.
- Additional ITMS-91053 categories Apple may email after the first TestFlight
  upload; fold those into the same aggregate when discovered.

## Verification

- `npm run typecheck`
- `npm test` (security pin for privacy manifests)
- `node -e` JSON parse of `app.json` privacyManifests shape
