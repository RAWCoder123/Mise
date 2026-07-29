# TestFlight store-distribution profile evidence

Verified: 2026-07-28

Source checkpoint:
`041f224b375fc61088588debfb47aee73ce4a43a`

## Corrected release boundary

The previous `ios:testflight:build` command selected EAS `preview`, whose
`distribution: internal` setting creates an ad hoc device build. That artifact
is not a TestFlight candidate.

The command now selects a dedicated `testflight` profile that resolves to:

- platform: iOS;
- distribution: App Store;
- credential source: remote EAS-managed credentials;
- EAS environment: Preview;
- application environment: staging;
- deterministic reviewer demo access: enabled; and
- release identity: `mise-mobile@0.1.0+2`.

The ad hoc `preview` profile remains available for explicitly registered-device
testing but cannot satisfy TestFlight build or release evidence.

## Verification

- `npm run qa:eas-account`: passed for `@raymondaws-team/mise`.
- `npm run typecheck`: passed.
- `npm test`: 330 passed.
- The dedicated tooling test requires `distribution: store`, Preview/staging
  isolation, reviewer demo access, and matching build/submit profile names.
- `eas config --platform ios --profile testflight --non-interactive` resolved
  the expected App Store configuration.
- The TestFlight archive inspection again contained zero files under `.cursor`,
  `site`, `docs`, `scripts`, `supabase`, or `tests`.
- No `.env`, staging operator environment, certificate, provisioning profile, or
  local credential file entered the archive.
- The TestFlight pre-build inspection selected remote iOS credentials and
  stopped at the Apple-account authorization boundary.

No Apple identifier, password, 2FA code, session, certificate, profile, cloud
build, upload, submission, or production action was created by this batch.

## Required handoff

An authorized Apple Developer Program Account Holder or Admin must complete the
Apple login and 2FA prompt locally. EAS can then create and validate the missing
App Store distribution certificate and provisioning profile for
`com.mise.mobile`.
