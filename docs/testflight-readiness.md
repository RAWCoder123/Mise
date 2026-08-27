# Mise TestFlight Readiness

This pass targets the August 3 invite-only restaurant TestFlight beta. Public
App Store submission remains a later gate. The beta uses manual/CSV data and
external supplier communication; Square, Gmail delivery, generative AI,
billing, and autonomous ordering remain disabled.

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

`qa:ios-prereq` validates the app icon, supported `expo-splash-screen` plugin and splash asset, absence of legacy Expo fields, bundle identifier, build number, encryption setting, aggregated `ios.privacyManifests` required-reason API declarations, and local Xcode simulator tooling. It requires full Xcode, not only Command Line Tools.

## Invite-Only Restaurant TestFlight Path

1. Join or confirm access to the Apple Developer Program.
2. Create or open the App Store Connect app for bundle ID `com.mise.mobile`.
3. Confirm App Store Connect has monitored support and privacy-policy URLs.
4. Sign in to Expo/EAS:

```bash
npx --yes eas-cli@21.4.0 login
npx --yes eas-cli@21.4.0 whoami
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
9. Install through the TestFlight app on one recent and one older supported
   iPhone and walk through:
   - controlled restaurant invitation and restaurant selection
   - setup and daily sales CSV import
   - receiving, counts, waste, stockouts, and reconciliation
   - offline queue interruption and recovery
   - deterministic daily findings and manager feedback
   - supplier draft review and copy/export without in-app sending
   - Today
   - Inventory
   - Supplier orders
   - Insights
   - Settings
   - Setup
10. Record every receipt for the exact candidate commit in
    `docs/launch/BETA_RELEASE_EVIDENCE.json`.
11. Run `npm run beta:go-no-go`. Do not admit a restaurant until it passes.

## Replaceable Local Demo

The local demo preset is deterministic. It seeds:

- Restaurant: configured sample identity
- Profile: full-service sample kitchen
- 52 weeks of weekly POS history
- Current-day POS sales
- Inventory, recipe baselines, suppliers, supplier recipients, order drafts, POS connection state, and audit seed metadata

The dataset is local-only. It does not touch hosted Supabase tenant data. Replace its identity and fixture rows in `services/demo/` without changing screens or Supabase repositories.

## Required Before The August 3 Restaurant Beta

- Hosted Supabase staging project with migrations applied
- Two-restaurant tenant isolation checks on staging
- Monitored privacy-policy and support URLs
- In-app account deletion or documented account deletion flow
- Production Supabase URL/anon key set in EAS secrets
- Controlled scrubbed Sentry and PostHog receipts
- Managed backup restoration into an isolated recovery environment
- Real device performance pass on at least one recent iPhone and one older supported iPhone
- Exact-commit Raymond approval and no unresolved P0/P1 defects

The first restaurant is admitted alone. The second remains held back until one
healthy operating day is reviewed. Public App Store distribution, supplier
delivery from Mise, Square, AI, and billing are separate later gates.

Official references:

- Expo EAS Submit: https://docs.expo.dev/submit/introduction/
- Apple TestFlight: https://developer.apple.com/testflight/
- Apple internal testers: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/
- Apple privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
