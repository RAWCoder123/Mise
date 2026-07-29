# External prerequisite handoffs

Verified: 2026-07-29T01:23:15Z

This evidence records external launch prerequisites that cannot be completed by
repository changes or unattended automation. It contains no passwords, 2FA
codes, session tokens, provider API keys, or private application data.

## Full Xcode

Read-only native-tooling inspection confirmed:

- `/Applications/Xcode.app` and `Xcode-beta.app` are absent;
- the selected developer directory is Command Line Tools;
- `xcodebuild` and `simctl` are unavailable; and
- the machine has approximately 598 GiB of free storage.

The official Mac App Store Xcode download is staged under the signed-in Apple
App Store account and is waiting for local Touch ID approval. No password was
entered or captured by Codex.

After approval and installation, Mise must select
`/Applications/Xcode.app/Contents/Developer`, finish first-launch components,
and rerun `npm run qa:ios-prereq`.

## Sentry

The Expo application already includes `@sentry/react-native`, bounded
`beforeSend` behavior, and a live-receipt verifier. EAS Preview has no
`EXPO_PUBLIC_SENTRY_DSN`, and Chrome has no authenticated Sentry session.

The Sentry sign-in page is open for a Raymond-controlled login. Creating a Mise
project, DSN, or API token remains prohibited until that authenticated handoff
is complete.

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
Chrome has no authenticated Cloudflare session, so no DNS record was changed.

After Raymond signs into the correct Cloudflare account, changing the apex
targets and adding the validation records requires an explicit action-time
confirmation because it changes production DNS.
