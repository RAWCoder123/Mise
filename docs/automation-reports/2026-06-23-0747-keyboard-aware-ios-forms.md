# Mise iOS Demo Readiness Automation Report

Run: 2026-06-23 07:47 America/New_York  
Automation: `mise-ios-demo-readiness`

## What changed

- Added opt-in keyboard-aware behavior to the shared `Screen` shell.
- Enabled keyboard-aware scrolling on form-heavy iOS demo routes:
  - setup onboarding
  - inventory count detail
  - supplier order draft detail
  - recipe baseline editing
- The screen shell now uses iOS keyboard padding, automatic keyboard insets, handled taps while editing, and interactive keyboard dismissal for scrollable screens.
- Updated the iOS demo checklist to explicitly verify keyboard behavior on setup and operator edit flows.

## Files touched

- `components/ui/Screen.tsx`
- `app/(auth)/setup.tsx`
- `app/inventory/[id].tsx`
- `app/orders/[id].tsx`
- `app/settings/recipes.tsx`
- `docs/ios-demo-checklist.md`
- `docs/automation-reports/2026-06-23-0747-keyboard-aware-ios-forms.md`

## Verification

- `npm run typecheck` passed.
- `npm run qa:mobile-layout` passed at 390px width with no horizontal overflow on `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.
- `npm run qa:routes` passed for `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.

## Still needs to be done

- Run the native iOS simulator or physical-device checklist. This run verified web-rendered mobile layout, not UIKit keyboard behavior in Simulator.
- Confirm the keyboard sweep on Setup, inventory detail, supplier draft detail, and recipe baselines.
- Apply hosted Supabase staging migrations and run the staging tenant check before using live restaurant data.

## Recommended next step

Run `npm run ios`, complete the updated checklist in `docs/ios-demo-checklist.md`, and fix any native keyboard, safe-area, or simulator-only layout issues found. If that walkthrough passes, the local-demo iOS experience is close to demoable.
