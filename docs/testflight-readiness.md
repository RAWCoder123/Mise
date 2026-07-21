# Mise TestFlight Readiness

This pass targets an internal TestFlight demo first. Public App Store submission and external TestFlight review still need Apple metadata, privacy, support, and account-deletion completion.

## Current iOS Identity

- App name: Mise
- Bundle identifier: `com.mise.mobile`
- Version: `0.1.0`
- iOS build number: `2`
- Internal preview profile: `eas.json` `build.preview`
- Production profile: `eas.json` `build.production`

## Preflight Checks

Run these before every iOS demo build:

```bash
npm run demo:ready
npm run qa:ios-prereq
```

`qa:ios-prereq` validates the app icon, supported `expo-splash-screen` plugin and splash asset, absence of legacy Expo fields, bundle identifier, build number, encryption setting, and local Xcode simulator tooling. It requires full Xcode, not only Command Line Tools.

## Internal TestFlight Path

1. Join or confirm access to the Apple Developer Program.
2. Create or open the App Store Connect app for bundle ID `com.mise.mobile`.
3. Confirm App Store Connect has a support URL, privacy policy URL, and app privacy answers started.
4. Sign in to Expo/EAS:

```bash
npx eas login
npx eas whoami
```

5. Run the local demo gate:

```bash
npm run ios:testflight:check
```

6. Build the internal iOS binary:

```bash
npm run ios:testflight:build
```

7. Submit the latest successful build to App Store Connect:

```bash
npm run ios:testflight:submit
```

8. In App Store Connect, open TestFlight, add an internal tester group, and attach the uploaded build.
9. Install through the TestFlight app on a real iPhone and walk through:
   - local demo-data load
   - Today
   - Inventory
   - Supplier orders
   - Insights
   - Settings
   - Setup

## Replaceable Local Demo

The local demo preset is deterministic. It seeds:

- Restaurant: configured sample identity
- Profile: full-service sample kitchen
- 52 weeks of weekly POS history
- Current-day POS sales
- Inventory, recipe baselines, suppliers, supplier recipients, order drafts, POS connection state, and audit seed metadata

The dataset is local-only. It does not touch hosted Supabase tenant data. Replace its identity and fixture rows in `services/demo/` without changing screens or Supabase repositories.

## Required Before External TestFlight Or Public Launch

- Hosted Supabase staging project with migrations applied
- Two-restaurant tenant isolation checks on staging
- Final Apple privacy questionnaire
- Privacy policy URL
- Support URL
- In-app account deletion or documented account deletion flow
- Production Supabase URL/anon key set in EAS secrets
- Sentry/PostHog production configuration if enabled
- Real device performance pass on at least one recent iPhone and one older supported iPhone

Official references:

- Expo EAS Submit: https://docs.expo.dev/submit/introduction/
- Apple TestFlight: https://developer.apple.com/testflight/
- Apple internal testers: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/
- Apple privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
