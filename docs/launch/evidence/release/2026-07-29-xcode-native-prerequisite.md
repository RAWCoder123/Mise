# Xcode and iOS simulator prerequisite evidence

Verified: `2026-07-29T07:21:41Z`

Repository checkpoint:
`3513e13a58c66bfa17bf08eeada5223b505fbc9a`

This receipt proves the local native-tooling prerequisite. It is not a
TestFlight build, App Store upload, physical-device walkthrough, or release
approval.

## Toolchain

- Xcode: `26.6` (`17F113`)
- Selected developer directory:
  `/Applications/Xcode.app/Contents/Developer`
- `simctl`:
  `/Applications/Xcode.app/Contents/Developer/usr/bin/simctl`
- Installed simulator runtime: iOS 26.5 (`23F77`, arm64)

The Xcode and Apple SDK agreement was accepted by Raymond before verification.
Codex did not accept the agreement on Raymond's behalf.

## Mise prerequisite gate

`npm run qa:ios-prereq` passed and verified:

- app icon, splash image, and favicon inputs;
- bundle identifier `com.mise.mobile`;
- build number `2`;
- the selected full-Xcode developer directory;
- an available `simctl`; and
- an available iPhone 17 Pro on the iOS 26.5 runtime.

## Simulator boot proof

The iPhone 17 Pro simulator
`458D3CFB-62AA-41B7-B5B0-4C4B19761F3B` completed first-boot migration and
reached terminal boot status. A subsequent `simctl` query reported it as
`Booted`, available, and last booted at `2026-07-29T07:19:26Z`.

## Intentionally pending

- App Store distribution certificate and provisioning profile
- EAS TestFlight cloud build and build identity
- Installation and critical-workflow checks on recent and older supported
  physical iPhones
- TestFlight submission and Raymond's release approval
