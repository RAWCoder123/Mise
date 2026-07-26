# Build Identity & Observability Setup

This doc covers the one-time, account-owner steps needed to produce store builds
and turn on production observability. None of these steps are required for
local development or demo mode — the app runs with zero configuration and makes
zero telemetry network calls when the env vars below are absent.

## Current build identity (checked in)

| Platform | Identifier | Version source |
| --- | --- | --- |
| iOS | `com.mise.mobile`, `buildNumber` in `app.json` | `eas.json` `appVersionSource: "local"` + `autoIncrement` on production |
| Android | `com.mise.mobile`, `versionCode` in `app.json` | same |

- Android adaptive icon reuses `assets/app-icon.png` as the foreground on a
  white (`#FFFFFF`) background, per the design system. Replace with a dedicated
  adaptive-icon asset (foreground with safe-zone padding) before Play launch if
  the cropped circle mask clips the mark.
- Android permissions: none are declared beyond Expo defaults (`INTERNET`,
  etc.). The "Scan invoice" action is currently a stub with no camera code;
  add `expo-camera` + its permission only when that feature ships.

## One-time owner steps (EAS / Expo)

`extra.eas.projectId` is intentionally NOT set in `app.json`. It must be
created under the owning Expo account — do not paste a placeholder value.

1. `npx eas login` — log in as the account that will own the app.
2. `npx eas init` — creates (or links) the EAS project and writes
   `extra.eas.projectId` into `app.json`. Commit that change.
3. Create build-time secrets (EAS injects them as env vars during `eas build`;
   because they are `EXPO_PUBLIC_*`, Expo inlines them into the JS bundle):

   ```sh
   npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "<url>"
   npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>"
   npx eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "<dsn>"
   npx eas secret:create --scope project --name EXPO_PUBLIC_POSTHOG_KEY --value "<project api key>"
   npx eas secret:create --scope project --name EXPO_PUBLIC_POSTHOG_HOST --value "https://us.i.posthog.com"
   ```

   (Newer EAS CLI versions expose the same thing as `eas env:create`.)

4. How profiles consume them: `eas.json` profiles only pin
   `EXPO_PUBLIC_APP_ENV` and `EXPO_PUBLIC_ENABLE_DEMO_MODE`; every secret
   above is merged into the build environment for all profiles. Nothing in
   this repo hardcodes those values, so a build without the secrets simply
   produces a demo-mode binary with telemetry disabled.

## Apple (existing flow)

- App Store Connect app for `com.mise.mobile` already exists; `eas submit
  --platform ios --profile production` uses the owner's ASC credentials/API key.

## Google Play (new for ~Oct 5 launch)

1. Create the app in the Play Console with package `com.mise.mobile`.
2. Upload the FIRST `.aab` manually in the Play Console (Play requires a
   manual first upload before API submissions work).
3. Create a Google Service Account with Play Console access, download its
   JSON key, and reference it from `submit.production.android` via
   `serviceAccountKeyPath` (keep the key out of git) or `eas credentials`.
4. `submit.production.android.track` is set to `internal` — promote to
   closed/production tracks from the Play Console.
5. Build with `npx eas build --platform android --profile production`
   (produces an app bundle).

## Sentry

1. Create a Sentry org + project (platform: React Native).
2. Store the DSN as the `EXPO_PUBLIC_SENTRY_DSN` EAS secret (step above).
   The app initializes Sentry only when the DSN is present at build time.
3. The `@sentry/react-native` Expo plugin is configured with no options on
   purpose: builds and `npx expo export` work with no Sentry credentials.
   To also upload source maps from EAS builds, add `SENTRY_AUTH_TOKEN` (secret)
   plus `SENTRY_ORG` / `SENTRY_PROJECT` env vars, or extend the plugin config
   with `organization` / `project` once the org exists. This is optional and
   can be done after launch.

## PostHog

1. Create a PostHog project; grab the project API key and ingestion host
   (e.g. `https://us.i.posthog.com`).
2. Store them as the `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST`
   EAS secrets (step above). Analytics stay fully disabled when either is
   absent.
