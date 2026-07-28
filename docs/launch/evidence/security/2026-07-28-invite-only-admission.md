# Invite-only beta admission evidence — 2026-07-28

## Result

The August 3 staging environment now accepts only Mise-admin-provisioned beta
users and restaurants. Existing invited users can sign in with email, while
public registration, anonymous admission, self-service restaurant creation,
and client-created owner membership fail closed.

No production project, branch, release, or public deployment was changed.

## Checkpoints

- Cursor invite-only UI: `dc0b186`
- Service-only restaurant provisioning and database admission: `7be80f4`
- Hosted Auth configuration and executable signup proof: `642bae0`

## Hosted staging proof

Target: `ycwozuyyxunnnvalydar` (`Mise Staging Security`)

- Applied migration
  `20260728210609_enforce_invite_only_beta_admission.sql` to staging only.
- Added a separate, non-secret staging configuration source at
  `supabase/environments/staging/supabase/config.toml`.
- Reconciled API, database, Auth, and Storage configuration with no remaining
  drift.
- Confirmed `disable_signup: true`.
- Confirmed email login remains enabled for invited users.
- Confirmed anonymous admission remains disabled.
- A direct anonymous `/auth/v1/signup` attempt returned HTTP 422 with
  `Signups not allowed for this instance`.
- The account-deletion lifecycle created a user through the Admin API, signed
  in, proved the legacy tenant-creation RPC was denied, provisioned the tenant
  through the service-only RPC, deleted the disposable tenant and Auth user,
  and preserved the sentinel tenant. Durable deletion audit:
  `06820571-8eb8-430d-9c00-20c085ea0dee`.
- The hosted learning proof provisioned a disposable tenant through the same
  service boundary, learned a bounded recommendation from 30 lb to the
  manager-approved 40 lb median, and removed its fixture without sending an
  order.

A read-only configuration reconciliation caught an intermediate Auth drift
before lifecycle acceptance. The prior staging confirmation, MFA, redirect,
and rate-limit values were restored in the final targeted update, and the
complete final reconciliation reported every service up to date.

## Local verification

- `npm run typecheck`: passed
- `npm test`: 318 passed
- `npm run security:backend`: passed
- `npm run supabase:test`: 566 pgTAP assertions passed; 20-request workspace
  race accepted 5, rejected 15, and preserved 5 immutable allocations; local
  security advisors reported no issues
- `npm run design:static`: passed
- `npm run qa:routes`: passed
- `npm run qa:interactions`: passed at 390x844 in English, Spanish, and
  Simplified Chinese with zero horizontal overflow
- `git diff --check`: passed

## Remaining external boundary

Production Auth and tenant admission remain undeployed until Raymond approves a
specific release candidate. EAS identity, full Xcode, physical-device
walkthroughs, live monitoring receipts, managed recovery, public privacy
hosting, monitored inboxes, and TestFlight delivery remain separate release
gate blockers.
