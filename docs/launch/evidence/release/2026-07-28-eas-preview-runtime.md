# EAS preview runtime evidence

Verified: 2026-07-28T23:30:28Z

## Result

The organization-owned Mise EAS project now contains the minimum hosted client
configuration required by the preview profile:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Both variables are project-scoped, limited to the `preview` environment, and
stored with sensitive visibility. Their values were never printed or committed.
No production EAS environment was changed.

## Verification

`eas env:list --environment preview --format long` showed exactly the two
expected project variables with masked values.

`eas config --platform ios --profile preview --non-interactive` confirmed:

- the preview environment loads both EAS variables;
- the profile remains `distribution: internal`;
- `EXPO_PUBLIC_APP_ENV` is `staging`;
- the build remains a physical-device build rather than a simulator build;
- the app owner is `raymondaws-team`;
- the EAS project ID is
  `bf74b605-68fb-4457-9eb8-e68b9c4aac0d`;
- the iOS bundle identifier remains `com.mise.mobile`.

The service-role key, database password, staging secret key, production
credentials, and provider credentials were not added.

## Remaining boundary

This evidence does not authorize or start an EAS build, Apple signing,
submission, TestFlight distribution, restaurant admission, or production
deployment. Sentry and PostHog remain optional and unconfigured for the
preview build until controlled provider receipts can be recorded.
