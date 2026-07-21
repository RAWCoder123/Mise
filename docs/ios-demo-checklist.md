# Mise iOS Demo Checklist

Use this checklist before handing Mise to an iOS demo user or recording a walkthrough.

For the broader owner/advisor/private-beta walkthrough, use `docs/private-beta-demo-readiness.md`.

## Build Identity

- App icon is configured at `assets/app-icon.png`.
- Splash image is configured at `assets/splash-icon.png` through the `expo-splash-screen` plugin; legacy `expo.splash` and `newArchEnabled` fields are absent.
- iOS bundle identifier is `com.mise.mobile`.
- iOS build number is set in `app.json`.
- Run `npm run qa:ios-prereq` on the Mac that will run the demo; it must pass before starting the simulator walkthrough.
- Demo builds should use `EXPO_PUBLIC_APP_ENV=development` or `staging`.
- Production-style builds must set `EXPO_PUBLIC_APP_ENV=production` and `EXPO_PUBLIC_ENABLE_DEMO_MODE=false`.

## First-Run Demo Path

- Launch the app with no Supabase env vars.
- Confirm Login shows the local demo option.
- Tap the local demo path and complete Setup.
- Confirm Setup opens with editable starter inventory, supplier, and recipe rows instead of an empty form.
- Confirm Today opens with sales, inventory alerts, recipe coverage, and supplier work.
- Close and reopen the app.
- Confirm Mise resumes to Today instead of returning to Login.

## Mobile Route Sweep

- Run `npm run qa:routes` to confirm the Expo web shell serves each demo route before manual simulator QA.
- Run `npm run qa:mobile-layout` on a Mac with Chrome installed to render each route at iPhone width and check for horizontal overflow.
- Run `npm run qa:interactions` for the canonical full route-and-operator demo proof; CircleCI installs Chrome/Chromium before running this gate.
- `/today`: no horizontal overflow; action cards and chart fit.
- `/inventory`: search, filters, summary tiles, and inventory cards fit.
- `/orders`: recommendation quantities and supplier draft actions fit.
- `/insights`: refresh action and insight cards fit.
- `/setup`: multiline fields and chips fit with keyboard open.
- `/settings`: iOS demo readiness tiles and check rows fit.

## Operator Flow

- Update one inventory count.
- Approve or adjust one suggested order.
- Copy one supplier draft.
- Refresh insights.
- Reset demo data from Settings.
- On iOS, open the keyboard on Setup, inventory detail, supplier draft detail, and recipe baselines; confirm the active field and primary action remain reachable.

## Remaining Release Work

- Run on iOS simulator or physical iPhone, not only web.
- Capture screenshots for App Store/TestFlight-style review if needed.
- Confirm Supabase RLS migration is applied before using live restaurant data.
