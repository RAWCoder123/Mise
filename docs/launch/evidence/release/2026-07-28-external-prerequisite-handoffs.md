# External prerequisite handoffs

Verified: 2026-07-29T01:23:15Z
Reverified: 2026-07-29T17:31:12Z

This evidence records external launch prerequisites that cannot be completed by
repository changes or unattended automation. It contains no passwords, 2FA
codes, session tokens, provider API keys, or private application data.

## Full Xcode

This handoff is resolved. Raymond approved the App Store installation and
accepted the Xcode and Apple SDK agreement. Xcode 26.6 is selected, the iOS
26.5 simulator runtime is installed, `npm run qa:ios-prereq` passes, and an
iPhone 17 Pro simulator completes first boot.

The authoritative completion receipt is
`docs/launch/evidence/release/2026-07-29-xcode-native-prerequisite.md`.

## Apple signing

Xcode is now signed in to a Raymond-controlled Apple Account. The account
exposes only a free `Personal Team`, whose visible capability is on-device
testing; it has zero provisioned devices. No paid Apple Developer Program team
is available in Xcode.

The organization-owned EAS project still reaches the optional Apple login
prompt for the `testflight` profile. The local macOS keychain reports zero
valid code-signing identities, and both supported provisioning-profile
directories contain zero profiles. A Personal Team cannot provide the App
Store distribution certificate and provisioning profile required by
TestFlight.

The secure handoff remains:

1. Raymond enrolls this Apple Account in the paid Apple Developer Program, or
   signs Xcode into an existing paid organization account with App Store
   distribution authority.
2. Xcode must then show the paid team rather than only `Personal Team`.
3. Run:

   ```text
   cd /Users/RAW/Documents/Mise
   npx --yes eas-cli@21.4.0 credentials --platform ios
   ```

4. Raymond selects `testflight`, completes Apple login and 2FA locally, and
   finishes the Build Credentials workflow.

Apple credentials and one-time codes must never be pasted into chat or
committed. Developer Program enrollment includes Apple's terms and annual fee,
so Raymond must perform it directly. A cloud build, upload, and TestFlight
submission remain separately approval-gated after signing validation.

## Sentry

The Expo application already includes `@sentry/react-native`, bounded
`beforeSend` behavior, and a live-receipt verifier. EAS Preview has no
`EXPO_PUBLIC_SENTRY_DSN`, and Chrome has no authenticated Sentry session.

The Sentry sign-in page was reverified at `https://sentry.io/auth/login/` and is
open for a Raymond-controlled login. Creating a Mise project, DSN, or API token
remains prohibited until that authenticated handoff is complete.

## Public privacy and support domain

Sites now has a pending custom-domain binding for `getmise.app` on the existing
Mise marketing project.

Required DNS target:

- apex IPv4: `162.159.143.30`
- apex IPv4: `172.66.3.26`
- canonical target: `custom-domains.chatgpt.site.`

Required validation records:

- TXT `_openai-site-verification.getmise.app` =
  `openai-site-verification=Uk_EEvzjJj3l5s98aqxl_1C0T9o3n2uDObs9070O0LA`
- TXT `_cf-custom-hostname.getmise.app` =
  `a19b9534-8636-4f0f-9b66-a43f7567619a`

Authoritative nameservers are Cloudflare. The current apex still resolves to
`104.21.92.243` and `172.67.200.249`; `/privacy` and `/support` time out.
The Cloudflare tab was reverified at `https://dash.cloudflare.com/login`;
Chrome has no authenticated Cloudflare session, so no DNS record was changed.

After Raymond signs into the correct Cloudflare account, changing the apex
targets and adding the validation records requires an explicit action-time
confirmation because it changes production DNS.
