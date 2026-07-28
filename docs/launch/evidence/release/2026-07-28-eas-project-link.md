# EAS project-link evidence

Verified: 2026-07-28T23:23:33Z

## Result

Mise is linked to one organization-owned EAS project:

- EAS owner: `raymondaws-team`
- Project: `@raymondaws-team/mise`
- Project ID: `bf74b605-68fb-4457-9eb8-e68b9c4aac0d`
- Dashboard: `https://expo.dev/accounts/raymondaws-team/projects/mise`
- iOS bundle identifier: `com.mise.mobile` (unchanged)
- Configuration commit: `5d98a7b98b46f3122f36265ccd21b2ff4e467f13`

No build, submission, production deployment, Apple credential operation, or
App Store action was started.

## Verification

- `npx --yes eas-cli@21.4.0 project:info --json`: returned the recorded project
  owner, full name, and project ID.
- `npm run qa:eas-account`: passed while authenticated to
  `raymondaws-team (Role: Owner)`.
- `npm run typecheck`: passed after linking.
- `npm test`: 330 tests passed after linking.
- `npx --yes eas-cli@21.4.0 env:list --environment preview`: returned no
  project-scoped preview variables.
- `npm run qa:ios-prereq`: validated the assets, bundle identifier, and build
  number, then failed closed because full Xcode and `simctl` are unavailable.

## Build boundary

The EAS project identity prerequisite is complete. A beta build must not start
yet because the preview environment has no project-scoped runtime
configuration. Full Xcode remains required for local simulator and native
release verification, but it is not required merely to use EAS cloud builds.

Before a hosted-tenant preview build, record and verify only the bounded public
client configuration required by the app. Never store a service-role key,
provider secret, or production credential in an Expo public environment
variable.
