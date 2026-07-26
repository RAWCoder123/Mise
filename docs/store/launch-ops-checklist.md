# Launch Ops Checklist — Owner Actions

Target: TestFlight beta Aug 24 · App Store submission Sep 7 · **iOS public launch Sep 14, 2026** · Google Play ~Oct 5.

These are the account-holder actions no agent can do for you. Engineering items live in the agent handoff doc. Do the "start immediately" items this week — they are the external clocks that set the launch date.

## Start immediately (week of Jul 27)

- [ ] **Apple Developer Program enrollment** ($99/yr). Can take days to clear identity verification. Needed for everything iOS.
- [ ] **Google Play Console account** ($25 one-time). New personal accounts must run a closed test with at least 12 testers for 14 continuous days before production access — this is why Android launches ~3 weeks after iOS. Recruit the 12 testers now (friends/staff are fine).
- [ ] **Google Cloud OAuth verification** for the Gmail send scope (restricted scope; 4–8 weeks). Submit now so "send from your Gmail" can ship post-launch. Launch itself uses Resend and does not wait for this.
- [ ] **Domain + two public pages**: privacy policy (publish `docs/store/privacy-policy.md`) and a support/contact page. Both URLs are required fields in App Store Connect.
- [ ] **Resend account**: verify the sending domain (e.g. `orders@getmise.app`), get the API key. Needed for supplier order email at launch.

## Once Apple enrollment clears (target: by Aug 7)

- [ ] Create the app record in App Store Connect (bundle `com.mise.mobile`).
- [ ] `eas login` + `eas init` in the repo to link the EAS project (writes `extra.eas.projectId`). Follow `docs/build-identity.md`.
- [ ] Set EAS secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`.
- [ ] Create Sentry and PostHog projects (free tiers fine); paste DSN/key into EAS secrets.
- [ ] Set Supabase Edge secrets for email: `RESEND_SEND_ENABLED=true`, `RESEND_API_KEY`, `MISE_ORDER_FROM_EMAIL`, `MISE_ORDER_FROM_NAME` (see `docs/resend-sending.md`).

## Before TestFlight beta (Aug 24)

- [ ] `npm run ios:testflight:build` + `:submit`; add 3–5 pilot restaurants as external testers (external TestFlight requires a one-time beta review, allow ~2 days).
- [ ] Upload the first Android build to the Play closed test track; start the 14-day clock with 12 testers.
- [ ] Fill Apple's App Privacy questionnaire using the answers in `docs/store/app-store-listing.md`.

## Before App Store submission (Sep 7)

- [ ] Screenshots per the plan in `docs/store/app-store-listing.md`.
- [ ] Listing copy (drafted in the same file), support URL, privacy URL, review notes with demo access instructions.
- [ ] Confirm account deletion works in the submitted build (Apple checks this).
- [ ] Verify the hosted staging security gate is green (engineering will have run `verify:private-beta-security:hosted`; do not submit if it is red).

## Launch week (Sep 14)

- [ ] Release the approved build (manual release, not automatic, so you control the moment).
- [ ] Watch Sentry for crash spikes the first 48 hours; keep a hotfix build path warm (`eas build` on `main`).
- [ ] Play production rollout ~Oct 5 once the 14-day closed test completes and review clears (start at 20% staged rollout).
