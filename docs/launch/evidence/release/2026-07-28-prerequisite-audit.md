# Release prerequisite audit — 2026-07-28

## Result

Mise's local, hosted-staging, and operational recovery foundations are healthy
enough to freeze a provisional release-candidate commit. The beta cannot yet be
built or opened because Apple/EAS access, full Xcode, live monitoring projects,
managed hosted recovery, public policy/support endpoints, physical devices,
TestFlight, and Raymond's exact-candidate approval remain external.

No production, App Store Connect, EAS, DNS, email, monitoring, or hosted
recovery state was changed during this audit.

## Operational evidence

- `npm run observability:check`: static correlation and whole-event redaction
  contract passed. Live provider proof was not attempted because the required
  Sentry and PostHog proof credentials are absent.
- `npm run recovery:staging-check`: passed against dedicated staging.
  - Target: ephemeral isolated PostgreSQL
  - Schemas: `public`, `private`
  - Tables verified: 46
  - Rows verified: 746
  - Auth identities stubbed: 6
  - Dump bytes: 530203
  - Dump SHA-256:
    `0b6b43550c5825e5d82ef15d49c0d2b19c1fd45092febdd4655adbeb27200e35`
  - Duration: 23.2 seconds
  - Row content emitted: false
  - Cleanup: ephemeral cluster removed

This recovery evidence verifies the operational dump and content-equivalence
path. It is not the required managed Supabase Auth, Storage, Vault, and
configuration recovery into a separate hosted project.

## iOS and EAS boundary

`npm run qa:ios-prereq` failed closed after validating the app icon, splash,
favicon, bundle identifier `com.mise.mobile`, and build number 2:

- Only `/Library/Developer/CommandLineTools` is installed/selected.
- `/Applications/Xcode.app` is absent.
- `simctl` is unavailable.

`npm run qa:eas-account` failed closed:

- EAS CLI 21.4.0 is not authenticated.
- `app.json` has no `expo.extra.eas.projectId`.

## Public operations boundary

- `https://getmise.app/`, `/privacy`, and `/support` did not return a web
  response during bounded checks.
- The domain publishes mail-forwarding MX records, but active monitoring of
  `support@getmise.app` and `privacy@getmise.app` was not proven.

## Release authority

`npm run beta:go-no-go -- --json` remains blocked with no candidate commit,
candidate build, exact-commit receipts, or Raymond approval recorded. This is
the expected fail-closed behavior. The evidence file must not be advanced until
each receipt is objectively verified against the same candidate commit.
